// Origen del visitante y moneda que implica (TIE_HU001 §1).
//
// Lo que estos tests defienden no es el camino feliz —una IP colombiana da
// COP— sino las tres decisiones que se toman en silencio y que, si se
// degradan, no producen ningún error: que "no sé" nunca se convierta en
// "extranjero", que el techo declarado de IPv6 no se dé por resuelto, y que
// la IP no la pueda dictar el visitante.
//
// Ver openspec/changes/deteccion-moneda-por-ip — specs/visitor-geolocation.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { origenDesdeCabeceras } from "@/modules/geo";
import { origenDeIp } from "@/modules/geo/lookup";
import { ipDeConfianza } from "@/modules/geo/ip";
import { currencyForOrigin } from "@/modules/pricing";

/** Cabeceras de una petición, como las recibe el módulo. */
function cabeceras(valores: Record<string, string>): Headers {
  return new Headers(valores);
}

const IP_COLOMBIANA = "190.85.100.1"; // ETB, Bogotá
const IP_ESTADOUNIDENSE = "8.8.8.8"; // Google, EE.UU.
const IPV6_COLOMBIANA = "2800:484:1234::1"; // rango 2800:484::/32, Colombia
const IPV6_EXTRANJERA = "2a00:1450:4001::1"; // Google, Europa

describe("origen por IPv4", () => {
  it("una IP colombiana da COP", () => {
    expect(origenDeIp(IP_COLOMBIANA)).toBe("colombia");
    expect(currencyForOrigin(origenDeIp(IP_COLOMBIANA))).toBe("COP");
  });

  it("una IP de otro país da USD", () => {
    expect(origenDeIp(IP_ESTADOUNIDENSE)).toBe("exterior");
    expect(currencyForOrigin(origenDeIp(IP_ESTADOUNIDENSE))).toBe("USD");
  });

  it("una IP en un hueco sin asignar es DESCONOCIDA, no extranjera", () => {
    // La invariante central del diseño. Los huecos de la tabla son espacio
    // que no está asignado a ningún país; un bloque colombiano nuevo nacerá
    // dentro de uno de ellos. Si un hueco se leyera como "exterior", ese
    // colombiano vería dólares —y una tienda no comprable si el catálogo
    // aún no tiene precios en USD—. 240.0.0.0 es espacio reservado.
    expect(origenDeIp("240.0.0.1")).toBe("desconocido");
    expect(currencyForOrigin(origenDeIp("240.0.0.1"))).toBe("COP");
  });

  it("una IPv4 envuelta en IPv6 se busca donde está, en la tabla de IPv4", () => {
    expect(origenDeIp(`::ffff:${IP_COLOMBIANA}`)).toBe("colombia");
  });
});

describe("origen por IPv6 — techo declarado", () => {
  it("una IPv6 colombiana se confirma", () => {
    expect(origenDeIp(IPV6_COLOMBIANA)).toBe("colombia");
  });

  it("una IPv6 extranjera queda en desconocido, y por tanto en COP", () => {
    // NO es un fallo: la tabla de IPv6 solo lleva los rangos colombianos
    // (design §3). Está fijado por test para que nadie lo "arregle" haciendo
    // que una IPv6 no colombiana pase a valer "exterior", que es el error caro.
    expect(origenDeIp(IPV6_EXTRANJERA)).toBe("desconocido");
    expect(currencyForOrigin(origenDeIp(IPV6_EXTRANJERA))).toBe("COP");
  });
});

describe("direcciones que no identifican a un visitante", () => {
  it("bucle local, redes privadas y CGNAT son desconocidas", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.9", "192.168.1.10", "100.64.3.9", "169.254.1.1", "::1", "fd00::1", "fe80::1"]) {
      expect(origenDeIp(ip), ip).toBe("desconocido");
    }
  });

  it("un texto que no es una IP no revienta la petición", () => {
    expect(origenDeIp("no-una-ip")).toBe("desconocido");
    expect(origenDeIp("999.1.1.1")).toBe("desconocido");
    expect(origenDeIp("")).toBe("desconocido");
    expect(origenDeIp(null)).toBe("desconocido");
  });
});

describe("la IP no la puede dictar el visitante", () => {
  it("se lee la entrada de la DERECHA de X-Forwarded-For", () => {
    // El cliente antepone una IP colombiana para que le pongan precios en
    // pesos; el borde añade la real al final. Gana la del borde.
    const h = cabeceras({ "x-forwarded-for": `${IP_COLOMBIANA}, ${IP_ESTADOUNIDENSE}` });
    expect(ipDeConfianza(h)).toBe(IP_ESTADOUNIDENSE);
    expect(origenDesdeCabeceras(h)).toBe("exterior");
  });

  it("x-real-ip sirve de respaldo cuando no hay cadena de reenvío", () => {
    expect(origenDesdeCabeceras(cabeceras({ "x-real-ip": IP_COLOMBIANA }))).toBe("colombia");
  });

  it("acepta puerto y corchetes", () => {
    expect(ipDeConfianza(cabeceras({ "x-forwarded-for": "8.8.8.8:44321" }))).toBe("8.8.8.8");
    expect(ipDeConfianza(cabeceras({ "x-forwarded-for": "[2800:484::1]:443" }))).toBe("2800:484::1");
  });

  it("sin ninguna cabecera de reenvío el origen es desconocido", () => {
    expect(origenDesdeCabeceras(cabeceras({}))).toBe("desconocido");
  });
});

describe("precedencia de fuentes", () => {
  it("la cabecera del CDN manda sobre la tabla", () => {
    const h = cabeceras({ "cf-ipcountry": "US", "x-forwarded-for": IP_COLOMBIANA });
    expect(origenDesdeCabeceras(h)).toBe("exterior");
  });

  it("una cabecera que NO identifica país cede el turno a la tabla", () => {
    // XX es el "no sé" de Cloudflare y T1 es la red Tor. Tomarlos por país
    // daría "exterior" a todo visitante que Cloudflare no sabe ubicar: el
    // error caro, llegando desde la fuente que se suponía más fiable.
    for (const valor of ["XX", "T1", "", "COL", "1"]) {
      const h = cabeceras({ "cf-ipcountry": valor, "x-forwarded-for": IP_COLOMBIANA });
      expect(origenDesdeCabeceras(h), valor).toBe("colombia");
    }
  });

  it("CO en la cabecera da Colombia sin mirar la IP", () => {
    const h = cabeceras({ "cf-ipcountry": "co", "x-forwarded-for": IP_ESTADOUNIDENSE });
    expect(origenDesdeCabeceras(h)).toBe("colombia");
  });
});

describe("lo que ve un visitante del exterior cuando falta el precio en su moneda", () => {
  // Decisión de Daniel del 31 ago 2026: quien entre desde fuera de Colombia ve
  // la tienda en USD, y un producto sin precio en dólares debe decir "no
  // disponible en USD". Lo que NO puede decir es "Agotado": el producto tiene
  // stock de sobra, y esa palabra manda a esperar una reposición que no
  // existe, contradiciendo al precio que justo encima ya dice otra cosa.
  const ficha = readFileSync("src/app/(tienda)/producto/[slug]/product-detail.tsx", "utf8");

  it("separa 'agotado' de 'sin precio en esta moneda'", () => {
    expect(ficha).toContain("const agotado = units === 0;");
    expect(ficha).toContain("const sinPrecioEnMoneda = !price?.available;");
  });

  it("el motivo que se enseña nombra la moneda", () => {
    expect(ficha).toContain("`No disponible en ${currency}`");
  });

  it("no imprime el importe de un precio que no está cargado", () => {
    // `formatMoney` de un precio no cargado da "$0.00", que se lee como un
    // producto gratis. La barra de compra móvil lo hacía.
    expect(ficha).toContain("{price?.available && (");
  });
});
