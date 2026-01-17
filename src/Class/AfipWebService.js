"use strict";

const soap = require("soap");

/**
 * Base class for AFIP web services (DIRECT SOAP, no proxy)
 */
module.exports = class AfipWebService {
  constructor(webServiceOptions, options = {}) {
    if (!webServiceOptions) throw new Error("Missing Web Service Object");

    this.soapv12 = webServiceOptions.soapV12 || false;

    this.WSDL = webServiceOptions.WSDL;
    this.URL = webServiceOptions.URL;

    this.WSDL_TEST = webServiceOptions.WSDL_TEST;
    this.URL_TEST = webServiceOptions.URL_TEST;

    this.afip = webServiceOptions.afip;
    this.options = options;

    if (options["WSDL"]) this.WSDL = options["WSDL"];
    if (options["URL"]) this.URL = options["URL"];
    if (options["WSDL_TEST"]) this.WSDL_TEST = options["WSDL_TEST"];
    if (options["URL_TEST"]) this.URL_TEST = options["URL_TEST"];

    if (options["generic"] === true) {
      if (typeof options["service"] === "undefined") {
        throw new Error("service field is required in options");
      }
      if (typeof options["soapV1_2"] === "undefined") {
        options["soapV1_2"] = true;
      }
      this.soapv12 = options["soapV1_2"];
    }
  }

  /**
   * Get Token Authorization from WSAA
   */
  async getTokenAuthorization(force = false) {
    return this.afip.GetServiceTA(this.options["service"], force);
  }

  /**
   * Resolve WSDL/URL by environment
   */
  _getWsdlUrl() {
    const prod = this.afip.options["production"] === true;

    const wsdl = prod ? this.WSDL : this.WSDL_TEST;
    const url = prod ? this.URL : this.URL_TEST;

    if (!wsdl) throw new Error("WSDL not configured for this service");
    if (!url) throw new Error("URL not configured for this service");

    return { wsdl, url };
  }

  /**
   * Create SOAP client (cached per instance)
   */
  async _getSoapClient() {
    if (this._soapClient) return this._soapClient;

    const { wsdl, url } = this._getWsdlUrl();

    // soap lib: WSDL puede ser ruta local o URL remota
    const client = await soap.createClientAsync(wsdl, {
      disableCache: true,
      endpoint: url,
    });

    // SOAP 1.2 si aplica
    if (this.soapv12 && typeof client.setSOAPAction === "function") {
      // soap package maneja 1.2 con headers; no siempre hace falta setSOAPAction
      // pero lo dejamos sin romper.
    }

    this._soapClient = client;
    return client;
  }

  /**
   * Execute SOAP request against AFIP (direct)
   *
   * @param {string} method SOAP operation name (ej: FECAESolicitar)
   * @param {any} params Parameters object to send
   */
  async executeRequest(method, params = {}) {
    const client = await this._getSoapClient();

    const fn = client[`${method}Async`];
    if (typeof fn !== "function") {
      const ops = Object.keys(client)
        .filter((k) => k.endsWith("Async"))
        .slice(0, 40);
      throw new Error(
        `SOAP method not found: ${method}. Available (sample): ${ops.join(", ")}`,
      );
    }

    const [result] = await fn.call(client, params);
    return result;
  }
};
