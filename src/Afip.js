"use strict";

const fs = require("fs");
const path = require("path");
const soap = require("soap");
const forge = require("node-forge");
const xml2js = require("xml2js");

// Generic Web Service
const AfipWebService = require("./Class/AfipWebService");

// Available Web Services
const ElectronicBilling = require("./Class/ElectronicBilling");
const RegisterScopeFour = require("./Class/RegisterScopeFour");
const RegisterScopeFive = require("./Class/RegisterScopeFive");
const RegisterInscriptionProof = require("./Class/RegisterInscriptionProof");
const RegisterScopeTen = require("./Class/RegisterScopeTen");
const RegisterScopeThirteen = require("./Class/RegisterScopeThirteen");
const WSCpe = require("./Class/WSCpe");
const WSLpg = require("./Class/WSLpg");

/**
 * Software Development Kit for ARCA/AFIP web services (direct WSAA, no proxy)
 *
 * Fork: WSAA LoginCms + TA cache en archivo
 */
module.exports = Afip;

// XML parser (compatible con el estilo del SDK viejo)
const xmlParser = new xml2js.Parser({
  normalizeTags: true,
  normalize: true,
  explicitArray: false,
  attrkey: "header",
  tagNameProcessors: [(key) => String(key || "").replace("soapenv:", "")],
});

function isFile(p) {
  try {
    return !!p && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function ensureAbsFromCwd(p) {
  if (!p) return null;
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

function resolveDefaultCertKeyPaths({ production }) {
  // Si el usuario NO pasa cert/key en options, intentamos por env:
  // AFIP_CERT_PATH / AFIP_KEY_PATH (tu owner, como venís trabajando)
  const certEnv = process.env.AFIP_CERT_PATH;
  const keyEnv = process.env.AFIP_KEY_PATH;

  // fallback: platform por ambiente (si querés usarlo así también)
  const certPlat = production
    ? process.env.PLATFORM_AFIP_CERT_PROD_PATH
    : process.env.PLATFORM_AFIP_CERT_HOMO_PATH;
  const keyPlat = production
    ? process.env.PLATFORM_AFIP_KEY_PROD_PATH
    : process.env.PLATFORM_AFIP_KEY_HOMO_PATH;

  const cert = ensureAbsFromCwd(certEnv || certPlat);
  const key = ensureAbsFromCwd(keyEnv || keyPlat);

  return { cert, key };
}

function Afip(options = {}) {
  if (!(this instanceof Afip)) return new Afip(options);

  // Defaults
  if (!options.hasOwnProperty("CUIT")) options.CUIT = undefined;
  if (!options.hasOwnProperty("production")) options.production = false;
  if (options.production !== true) options.production = false;

  // Paths (archivos)
  // Si te pasan paths por options, los usamos.
  // Si no, intentamos resolver por env (AFIP_CERT_PATH/AFIP_KEY_PATH o PLATFORM_* por ambiente).
  if (!options.hasOwnProperty("cert")) options.cert = undefined;
  if (!options.hasOwnProperty("key")) options.key = undefined;

  // WSDL y TA folder
  if (!options.hasOwnProperty("wsaa_wsdl"))
    options.wsaa_wsdl = path.resolve(__dirname, "Afip_res", "wsaa.wsdl");
  if (!options.hasOwnProperty("ta_folder"))
    options.ta_folder = path.resolve(__dirname, "Afip_res");

  // Validaciones mínimas
  if (!options.CUIT) throw new Error("CUIT field is required in options array");

  this.sdk_version_number = "1.2.2-direct";

  this.options = options;

  this.CUIT = options.CUIT;

  // Resolve cert/key paths
  const production = options.production === true;

  let certPath = options.cert ? ensureAbsFromCwd(options.cert) : null;
  let keyPath = options.key ? ensureAbsFromCwd(options.key) : null;

  if (!certPath || !keyPath) {
    const d = resolveDefaultCertKeyPaths({ production });
    certPath = certPath || d.cert;
    keyPath = keyPath || d.key;
  }

  if (!isFile(certPath) || !isFile(keyPath)) {
    // Nota: acá exigimos ARCHIVO porque tu caso es por .env con rutas
    throw new Error(
      "Cert/key no configurados o no existen. " +
        "Seteá options.cert/options.key o AFIP_CERT_PATH/AFIP_KEY_PATH (y/o PLATFORM_AFIP_*_PATH). " +
        `cert=${certPath || "null"} key=${keyPath || "null"}`,
    );
  }

  this.CERT = certPath;
  this.PRIVATEKEY = keyPath;

  this.WSAA_WSDL = ensureAbsFromCwd(options.wsaa_wsdl);
  this.TA_FOLDER = ensureAbsFromCwd(options.ta_folder);

  if (!this.WSAA_WSDL || !isFile(this.WSAA_WSDL)) {
    throw new Error(`WSAA WSDL no encontrado: ${this.WSAA_WSDL || "null"}`);
  }

  if (!this.TA_FOLDER) {
    throw new Error("ta_folder inválido");
  }
  if (!fs.existsSync(this.TA_FOLDER)) {
    fs.mkdirSync(this.TA_FOLDER, { recursive: true });
  }

  this.WSAA_URL = production
    ? "https://wsaa.afip.gov.ar/ws/services/LoginCms"
    : "https://wsaahomo.afip.gov.ar/ws/services/LoginCms";

  // Services
  this.ElectronicBilling = new ElectronicBilling(this);
  this.RegisterScopeFour = new RegisterScopeFour(this);
  this.RegisterScopeFive = new RegisterScopeFive(this);
  this.RegisterInscriptionProof = new RegisterInscriptionProof(this);
  this.RegisterScopeTen = new RegisterScopeTen(this);
  this.RegisterScopeThirteen = new RegisterScopeThirteen(this);
  this.CPE = new WSCpe(this);
  this.LPG = new WSLpg(this);
}

/**
 * TA cache filename
 */
Afip.prototype._taFilePath = function (service) {
  const suffix = this.options.production ? "-production" : "";
  return path.resolve(
    this.TA_FOLDER,
    `TA-${this.options.CUIT}-${service}${suffix}.json`,
  );
};

/**
 * Gets token authorization for an AFIP Web Service (WSAA direct)
 *
 * @param {string} service WSID (ej: wsfe, ws_sr_padron_a13, etc.)
 * @param {boolean} force Si true, fuerza regenerar TA
 */
Afip.prototype.GetServiceTA = async function (service, force = false) {
  const taFilePath = this._taFilePath(service);

  if (!force && fs.existsSync(taFilePath)) {
    try {
      const taData = JSON.parse(fs.readFileSync(taFilePath, "utf8"));

      // ventana de 10 min como el SDK viejo
      const actualTime = new Date(Date.now() + 600000);
      const expirationTime = new Date(
        taData?.header?.expirationtime || taData?.header?.expirationTime,
      );

      if (actualTime < expirationTime) {
        return {
          token: taData.credentials.token,
          sign: taData.credentials.sign,
        };
      }
    } catch (_) {
      // si se corrompió el cache, seguimos y regeneramos
    }
  }

  await this.CreateServiceTA(service);

  // Re-lee el cache recién creado
  const taData = JSON.parse(fs.readFileSync(taFilePath, "utf8"));
  return {
    token: taData.credentials.token,
    sign: taData.credentials.sign,
  };
};

/**
 * Create TA from WSAA (LoginCms) and save in cache file
 */
Afip.prototype.CreateServiceTA = async function (service) {
  const date = new Date();

  const tra = `<?xml version="1.0" encoding="UTF-8" ?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Math.floor(date.getTime() / 1000)}</uniqueId>
    <generationTime>${new Date(date.getTime() - 600000).toISOString()}</generationTime>
    <expirationTime>${new Date(date.getTime() + 600000).toISOString()}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`.trim();

  // Leer PEMs desde ARCHIVO
  const certPem = fs.readFileSync(this.CERT, { encoding: "utf8" });
  const keyPem = fs.readFileSync(this.PRIVATEKEY, { encoding: "utf8" });

  // Parse a objetos forge (clave para que no tire “cert inválido”)
  const certObj = forge.pki.certificateFromPem(certPem);
  const keyObj = forge.pki.privateKeyFromPem(keyPem);

  // Firmar TRA (CMS)
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(tra, "utf8");
  p7.addCertificate(certObj);
  p7.addSigner({
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
    certificate: certObj,
    digestAlgorithm: forge.pki.oids.sha256,
    key: keyObj,
  });

  p7.sign();
  const bytes = forge.asn1.toDer(p7.toAsn1()).getBytes();
  const signedTRA = Buffer.from(bytes, "binary").toString("base64");

  // Crear cliente SOAP WSAA (usa wsaa.wsdl local)
  const soapClient = await soap.createClientAsync(this.WSAA_WSDL, {
    disableCache: true,
    endpoint: this.WSAA_URL,
  });

  // LoginCms
  const [loginCmsResult] = await soapClient.loginCmsAsync({ in0: signedTRA });

  // Parse loginCmsReturn (XML dentro de XML)
  const res = await xmlParser.parseStringPromise(loginCmsResult.loginCmsReturn);

  const taFilePath = this._taFilePath(service);

  // Guardar cache TA
  await fs.promises.writeFile(
    taFilePath,
    JSON.stringify(res.loginticketresponse),
  );
};

/**
 * Create generic Web Service
 */
Afip.prototype.WebService = function (service, options = {}) {
  options.service = service;
  options.generic = true;
  return new AfipWebService({ afip: this }, options);
};

// =======
// Métodos que dependían del proxy de afipsdk.com (los deshabilitamos explícitamente)
// =======
Afip.prototype.getLastRequestXML = async function () {
  throw new Error(
    "getLastRequestXML no disponible en fork directo (sin app.afipsdk.com).",
  );
};
Afip.prototype.CreateCert = async function () {
  throw new Error(
    "CreateCert no disponible en fork directo (sin app.afipsdk.com).",
  );
};
Afip.prototype.CreateWSAuth = async function () {
  throw new Error(
    "CreateWSAuth no disponible en fork directo (sin app.afipsdk.com).",
  );
};
Afip.prototype.CreateAutomation = async function () {
  throw new Error(
    "CreateAutomation no disponible en fork directo (sin app.afipsdk.com).",
  );
};
Afip.prototype.GetAutomationDetails = async function () {
  throw new Error(
    "GetAutomationDetails no disponible en fork directo (sin app.afipsdk.com).",
  );
};
