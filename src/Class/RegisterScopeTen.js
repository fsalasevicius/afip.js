const AfipWebService = require("./AfipWebService");

/**
 * SDK for AFIP Register Scope Ten (ws_sr_padron_a10)
 */
module.exports = class RegisterScopeTen extends AfipWebService {
  constructor(afip) {
    const options = {
      soapV12: false,
      WSDL: "ws_sr_padron_a10-production.wsdl",
      URL: "https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA10",
      WSDL_TEST: "ws_sr_padron_a10.wsdl",
      URL_TEST: "https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA10",
      afip,
    };

    super(options, { service: "ws_sr_padron_a10" });
  }

  async getServerStatus() {
    return this.executeRequest("dummy");
  }

  /**
   * Devuelve null si el CUIT no existe.
   */
  async getTaxpayerDetails(identifier) {
    const { token, sign } = await this.afip.GetServiceTA("ws_sr_padron_a10");

    const params = {
      token,
      sign,
      cuitRepresentada: this.afip.CUIT,
      idPersona: identifier,
    };

    try {
      const res = await this.executeRequest("getPersona", params);
      // según implementación puede venir {persona: ...} o directo
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
