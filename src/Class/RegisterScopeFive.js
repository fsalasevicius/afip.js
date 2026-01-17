const AfipWebService = require("./AfipWebService");

/**
 * SDK for AFIP Register Scope Five (ws_sr_padron_a5)
 *
 * Nota:
 * - Este WS se usa mucho para datos “A5” (domicilio / impuestos / IVA / monotributo)
 * - En tu fork, lo mantenemos por compatibilidad.
 * - Recomendado usar RegisterInscriptionProof (ws_sr_constancia_inscripcion) para constancia.
 */
module.exports = class RegisterScopeFive extends AfipWebService {
  constructor(afip) {
    const options = {
      soapV12: false,
      WSDL: "ws_sr_padron_a5-production.wsdl",
      URL: "https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA5",
      WSDL_TEST: "ws_sr_padron_a5.wsdl",
      URL_TEST: "https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA5",
      afip,
    };

    super(options, { service: "ws_sr_padron_a5" });
  }

  async getServerStatus() {
    return this.executeRequest("dummy");
  }

  /**
   * Devuelve null si el CUIT no existe.
   */
  async getTaxpayerDetails(identifier) {
    const { token, sign } = await this.afip.GetServiceTA("ws_sr_padron_a5");

    const params = {
      token,
      sign,
      cuitRepresentada: this.afip.CUIT,
      idPersona: identifier,
    };

    try {
      return await this.executeRequest("getPersona_v2", params);
    } catch (err) {
      if (err?.code === 602) return null;
      if (/no existe/i.test(err?.message || "")) return null;
      throw err;
    }
  }

  /**
   * Batch de CUITs. Normaliza salida a array.
   */
  async getTaxpayersDetails(identifiers) {
    const { token, sign } = await this.afip.GetServiceTA("ws_sr_padron_a5");

    const params = {
      token,
      sign,
      cuitRepresentada: this.afip.CUIT,
      idPersona: identifiers,
    };

    const res = await this.executeRequest("getPersonaList_v2", params);

    const out = res?.persona;
    if (!out) return [];
    return Array.isArray(out) ? out : [out];
  }

  async executeRequest(operation, params = {}) {
    const results = await super.executeRequest(operation, params);

    return results[
      operation === "getPersona_v2"
        ? "personaReturn"
        : operation === "getPersonaList_v2"
          ? "personaListReturn"
          : "return"
    ];
  }
};
