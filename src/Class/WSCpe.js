const AfipWebService = require("./AfipWebService");

/**
 * WS CPE (Carta de Porte Electrónica)
 * Dejá esto como stub inicial y vamos sumando métodos.
 */
module.exports = class WSCpe extends AfipWebService {
  constructor(afip) {
    const options = {
      soapV12: false, // lo confirmamos con WSDL/manual cuando lo tengas
      WSDL: "wscpe.wsdl",
      URL: "https://serviciosjava.afip.gob.ar/wscpe/services/CpeService",
      WSDL_TEST: "wscpe.wsdl",
      URL_TEST: "https://fwshomo.afip.gov.ar/wscpe/services/CpeService",
      afip,
    };

    // IMPORTANTE: este "service" debe coincidir con el wsid real del WSAA para CPE
    super(options, { service: "wscpe" });
  }

  async dummy() {
    return this.executeRequest("dummy");
  }

  // Ejemplo de patrón (cuando sepamos operación real)
  async consultar(params = {}) {
    const { token, sign } = await this.afip.GetServiceTA(this.options.service);

    return this.executeRequest("consultar", {
      token,
      sign,
      cuitRepresentada: this.afip.CUIT,
      ...params,
    });
  }
};
