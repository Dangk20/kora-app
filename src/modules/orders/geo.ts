// Listas estáticas del checkout (PED_HU001): se cargan con la página, sin
// llamadas por tecleo.

/** Los 32 departamentos de Colombia + Bogotá D.C. (división DANE). */
export const DEPARTAMENTOS_CO = [
  "Amazonas",
  "Antioquia",
  "Arauca",
  "Archipiélago de San Andrés, Providencia y Santa Catalina",
  "Atlántico",
  "Bogotá D.C.",
  "Bolívar",
  "Boyacá",
  "Caldas",
  "Caquetá",
  "Casanare",
  "Cauca",
  "Cesar",
  "Chocó",
  "Córdoba",
  "Cundinamarca",
  "Guainía",
  "Guaviare",
  "Huila",
  "La Guajira",
  "Magdalena",
  "Meta",
  "Nariño",
  "Norte de Santander",
  "Putumayo",
  "Quindío",
  "Risaralda",
  "Santander",
  "Sucre",
  "Tolima",
  "Valle del Cauca",
  "Vaupés",
  "Vichada",
] as const;

/**
 * Sugerencias de ciudad por departamento (capital + principales municipios).
 * ⚠️ NO es la lista DANE completa (~1.100 municipios): la ciudad es un campo
 * de texto con estas sugerencias, así que ningún comprador queda bloqueado.
 * Cambiar a select cerrado cuando se cargue el catálogo DANE oficial.
 */
export const CIUDADES_SUGERIDAS: Record<string, string[]> = {
  Amazonas: ["Leticia", "Puerto Nariño"],
  Antioquia: ["Medellín", "Bello", "Itagüí", "Envigado", "Apartadó", "Rionegro", "Turbo", "Sabaneta"],
  Arauca: ["Arauca", "Saravena", "Tame"],
  "Archipiélago de San Andrés, Providencia y Santa Catalina": ["San Andrés", "Providencia"],
  Atlántico: ["Barranquilla", "Soledad", "Malambo", "Sabanalarga", "Puerto Colombia"],
  "Bogotá D.C.": ["Bogotá"],
  Bolívar: ["Cartagena", "Magangué", "Turbaco", "El Carmen de Bolívar"],
  Boyacá: ["Tunja", "Duitama", "Sogamoso", "Chiquinquirá"],
  Caldas: ["Manizales", "Villamaría", "La Dorada", "Chinchiná"],
  Caquetá: ["Florencia", "San Vicente del Caguán"],
  Casanare: ["Yopal", "Aguazul", "Villanueva"],
  Cauca: ["Popayán", "Santander de Quilichao", "Puerto Tejada"],
  Cesar: ["Valledupar", "Aguachica", "Codazzi"],
  Chocó: ["Quibdó", "Istmina", "Riosucio"],
  Córdoba: ["Montería", "Lorica", "Cereté", "Sahagún"],
  Cundinamarca: ["Soacha", "Fusagasugá", "Facatativá", "Zipaquirá", "Chía", "Girardot", "Mosquera", "Madrid", "Funza", "Cajicá"],
  Guainía: ["Inírida"],
  Guaviare: ["San José del Guaviare"],
  Huila: ["Neiva", "Pitalito", "Garzón"],
  "La Guajira": ["Riohacha", "Maicao", "Uribia", "Fonseca"],
  Magdalena: ["Santa Marta", "Ciénaga", "Fundación", "El Banco"],
  Meta: ["Villavicencio", "Acacías", "Granada"],
  Nariño: ["Pasto", "Tumaco", "Ipiales", "Túquerres"],
  "Norte de Santander": ["Cúcuta", "Ocaña", "Pamplona", "Villa del Rosario"],
  Putumayo: ["Mocoa", "Puerto Asís", "Orito"],
  Quindío: ["Armenia", "Calarcá", "Montenegro"],
  Risaralda: ["Pereira", "Dosquebradas", "Santa Rosa de Cabal"],
  Santander: ["Bucaramanga", "Floridablanca", "Girón", "Piedecuesta", "Barrancabermeja", "San Gil"],
  Sucre: ["Sincelejo", "Corozal", "Sampués"],
  Tolima: ["Ibagué", "Espinal", "Melgar", "Honda"],
  "Valle del Cauca": ["Cali", "Palmira", "Buenaventura", "Tuluá", "Cartago", "Buga", "Jamundí", "Yumbo"],
  Vaupés: ["Mitú"],
  Vichada: ["Puerto Carreño"],
};

/** 50 estados + DC. */
export const US_STATES = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" }, { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" }, { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" }, { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" }, { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" }, { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" }, { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" }, { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" }, { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" }, { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
] as const;

/**
 * Métodos de pago iniciales por país (PED_HU001 §2/§3).
 * La pantalla de configuración para administrarlos es otra HU.
 */
export const PAYMENT_METHODS: Record<"CO" | "US", string[]> = {
  CO: ["Nequi", "Daviplata", "Transferencia Bancolombia", "Efectivo contra entrega"],
  US: ["Zelle", "PayPal", "Venmo", "Otro (a acordar por WhatsApp)"],
};

export const DOCUMENT_TYPES = ["CC", "CE", "NIT"] as const;
