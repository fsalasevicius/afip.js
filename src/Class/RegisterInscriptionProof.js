const AfipWebService = require("./AfipWebService");

/**
 * SDK for AFIP Register Inscription Proof (ws_sr_constancia_inscripcion)
 **/
module.exports = class RegisterInscriptionProof extends AfipWebService {
  constructor(afip) {
    const options = {
      soapV12: false,

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
    const { token, sign } = await this.getTokenAuthorization();

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

  async getTaxpayersDetails(identifiers) {
    const { token, sign } = await this.getTokenAuthorization();

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
    const result = await super.executeRequest(operation, params);

    // soporta ambas variantes: {personaReturn} o {return:{personaReturn}}
    const direct =
      operation === "getPersona_v2"
        ? result?.personaReturn
        : operation === "getPersonaList_v2"
          ? result?.personaListReturn
          : result?.return;

    const wrapped =
      operation === "getPersona_v2"
        ? result?.return?.personaReturn
        : operation === "getPersonaList_v2"
          ? result?.return?.personaListReturn
          : null;

    return direct ?? wrapped ?? result?.return ?? result;
  }
};
