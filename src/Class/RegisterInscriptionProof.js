const AfipWebService = require("./AfipWebService");

/**
 * SDK for AFIP Register Inscription Proof
 * Service ID: ws_sr_constancia_inscripcion
 *
 * WS: personaServiceA5 (WSPCI / Constancia de Inscripción)
 */
module.exports = class RegisterInscriptionProof extends AfipWebService {
  constructor(afip) {
    const options = {
      soapV12: false,

      // ✅ WSDL remoto (AFIP)
      WSDL: "https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA5?WSDL",
      URL:  "https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA5",

      WSDL_TEST: "https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA5?WSDL",
      URL_TEST:  "https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA5",

      afip,
    };

    super(options, { service: "ws_sr_constancia_inscripcion" });
  }

  async getServerStatus() {
    return this.executeRequest("dummy");
  }

  async getTaxpayerDetails(identifier) {
    const { token, sign } = await this.afip.GetServiceTA("ws_sr_constancia_inscripcion");

    const params = {
      token,
      sign,
      cuitRepresentada: this.afip.CUIT,
      idPersona: Number(identifier),
    };

    try {
      // ✅ método v2 (manual WSCI)
      const res = await this.executeRequest("getPersona_v2", params);
      return res?.persona ?? res ?? null;
    } catch (err) {
      if (err?.code === 602) return null;
      if (/no existe/i.test(err?.message || "")) return null;
      throw err;
    }
  }

  async getTaxpayersDetails(identifiers) {
    const { token, sign } = await this.afip.GetServiceTA("ws_sr_constancia_inscripcion");

    const params = {
      token,
      sign,
      cuitRepresentada: this.afip.CUIT,
      idPersona: (Array.isArray(identifiers) ? identifiers : [identifiers]).map(Number),
    };

    const res = await this.executeRequest("getPersonaList_v2", params);

    const out = res?.persona;
    if (!out) return [];
    return Array.isArray(out) ? out : [out];
  }

  async executeRequest(operation, params = {}) {
    const results = await super.executeRequest(operation, params);

    // node-soap suele devolver { return: ... } o { xxxReturn: ... }
    return results[
      operation === "getPersona_v2"
        ? "personaReturn"
        : operation === "getPersonaList_v2"
          ? "personaListReturn"
          : "return"
    ];
  }
};
