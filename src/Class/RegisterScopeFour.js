const AfipWebService = require("./AfipWebService");

/**
 * SDK for AFIP Register Scope Four (ws_sr_padron_a4)
 */
module.exports = class RegisterScopeFour extends AfipWebService {
  constructor(afip) {
    const options = {
      soapV12: false,
      WSDL: "ws_sr_padron_a4-production.wsdl",
      URL: "https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA4",
      WSDL_TEST: "ws_sr_padron_a4.wsdl",
      URL_TEST: "https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA4",
      afip,
    };

    super(options, { service: "ws_sr_padron_a4" });
  }

  async getServerStatus() {
    return this.executeRequest("dummy");
  }

  /**
   * Devuelve null si el CUIT no existe.
   */
  async getTaxpayerDetails(identifier) {
    const { token, sign } = await this.afip.GetServiceTA("ws_sr_padron_a4");

    const params = {
      token,
      sign,
      cuitRepresentada: this.afip.CUIT,
      idPersona: identifier,
    };

    try {
      const res = await this.executeRequest("getPersona", params);
      // en A4 suele venir { persona: ... }
      return res?.persona ?? res ?? null;
    } catch (err) {
      if (err?.code === 602) return null;
      if (/no existe/i.test(err?.message || "")) return null;
      throw err;
    }
  }

  async executeRequest(operation, params = {}) {
    const results = await super.executeRequest(operation, params);
    return results[operation === "getPersona" ? "personaReturn" : "return"];
  }
};
