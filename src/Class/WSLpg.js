const AfipWebService = require("./AfipWebService");

/**
 * WS LPG / COE (Liquidación Primaria de Granos)
 * Stub inicial.
 */
module.exports = class WSLpg extends AfipWebService {
  constructor(afip) {
    const options = {
      soapV12: false,
      WSDL: "wslpg.wsdl",
      URL: "https://serviciosjava.afip.gob.ar/wslpg/LpgService",
      WSDL_TEST: "wslpg.wsdl",
      URL_TEST: "https://fwshomo.afip.gov.ar/wslpg/LpgService",
      afip,
    };

    // IMPORTANTE: este "service" debe coincidir con el wsid real del WSAA para LPG
    super(options, { service: "wslpg" });
  }

  async dummy() {
    return this.executeRequest("dummy");
  }

  // Ejemplo de patrón
  async autorizarLiquidacion(payload = {}) {
    const { token, sign } = await this.afip.GetServiceTA(this.options.service);

    return this.executeRequest("autorizarLiquidacion", {
      token,
      sign,
      cuitRepresentada: this.afip.CUIT,
      ...payload,
    });
  }
};
