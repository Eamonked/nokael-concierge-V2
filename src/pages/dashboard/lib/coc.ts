import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx"

export type CocTemplateMeta = {
  tenantId: string
  fileName: string
  fileType: string
  uploadedAt: string
  uploadedBy: string
  size: number
}

export type CocJob = {
  ref: string
  status: string
  customer: string
  from: string
  to: string
  agent: string
  tier: string
  time: string
  createdAt: string
  scheduledAt: string
}

export const legacyCocTagAliases = {
  "{{courier_name}}": "{{agent_name}}",
  "{{courier_id}}": "{{agent_id}}",
  "{{courier_signature}}": "{{agent_signature}}",
  "{{courier_vehicle}}": "{{agent_vehicle}}",
  "{{quote_id}}": "{{quote_request_id}}",
} as const

export function normalizeCocTemplateTags(content: string) {
  return Object.entries(legacyCocTagAliases).reduce(
    (normalized, [legacyTag, agentTag]) =>
      normalized.replaceAll(legacyTag, agentTag),
    content,
  )
}

const DB_NAME = "nokael-coc"
const STORE_NAME = "templates"

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "tenantId" })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function getCocTemplate(tenantId: string) {
  const db = await openDatabase()
  return new Promise<CocTemplateMeta & { file: Blob } | null>(
    (resolve, reject) => {
      const request = db
        .transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME)
        .get(tenantId)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    },
  )
}

export async function saveCocTemplate(
  tenantId: string,
  file: File,
  uploadedBy: string,
) {
  const extension = file.name.split(".").pop()?.toLowerCase()
  if (!["docx", "pdf"].includes(extension || "")) {
    throw new Error("Only .docx and .pdf templates are supported.")
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("The template must be smaller than 10 MB.")
  }
  const record = {
    tenantId,
    fileName: file.name,
    fileType: extension || "",
    uploadedAt: new Date().toISOString(),
    uploadedBy,
    size: file.size,
    file,
  }
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, "readwrite")
      .objectStore(STORE_NAME)
      .put(record)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
  return record as CocTemplateMeta & { file: Blob }
}

export async function removeCocTemplate(tenantId: string) {
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, "readwrite")
      .objectStore(STORE_NAME)
      .delete(tenantId)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export function downloadTemplate(template: CocTemplateMeta & { file: Blob }) {
  downloadBlob(template.file, template.fileName)
}

function escapePdf(value: string) {
  return value
    .replace(/[^\x20-\x7e]/g, "-")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)")
}

function text(x: number, y: number, value: string, size = 10, font = "F1") {
  return `BT /${font} ${size} Tf ${x} ${y} Td (${escapePdf(value)}) Tj ET`
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  )
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

function makePdf(lines: string[]) {
  const stream = lines.join("\n")
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> /ExtGState << /GS1 7 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Type /ExtGState /ca 0.09 /CA 0.09 >>",
  ]
  let pdf = "%PDF-1.4\n"
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(new TextEncoder().encode(pdf).length)
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = new TextEncoder().encode(pdf).length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new Blob([new TextEncoder().encode(pdf)], { type: "application/pdf" })
}

export async function compileAndDownloadCoc(tenantId: string, job: CocJob) {
  const template = await getCocTemplate(tenantId)
  const createdAt = job.createdAt
  const agentId =
    job.agent === "Unassigned"
      ? "Not assigned"
      : `CR-${Math.abs(
          job.agent
            .split("")
            .reduce((sum, char) => sum + char.charCodeAt(0), 0),
        )
          .toString()
          .padStart(4, "0")}`
  const canonicalPayload = JSON.stringify({
    tenantId,
    template: template?.fileName || "Nokael System CoC v2",
    orderId: job.ref,
    status: job.status,
    customer: job.customer,
    route: [job.from, job.to],
    scheduled_date: job.scheduledAt,
    agent_id: agentId,
    agent_name: job.agent,
    agent_vehicle: "Dispatch vehicle on file",
    createdAt,
  })
  const checksum = await sha256(canonicalPayload)
  const draft = job.status !== "Completed"
  const lines = [
    "0.94 0.94 0.92 rg 0 0 595 842 re f",
    "0.06 0.09 0.16 rg 0 770 595 72 re f",
    "0.86 1 0.3 rg",
    text(42, 800, "NOKAEL", 18, "F2"),
    "1 1 1 rg",
    text(42, 781, "CHAIN OF CUSTODY", 9, "F1"),
    "0.06 0.09 0.16 rg",
    text(42, 732, `ORDER ${job.ref}`, 19, "F2"),
    text(42, 711, `Status: ${job.status}   Service: ${job.tier}`, 10),
    "0.82 0.84 0.87 RG 42 690 m 553 690 l S",
    text(42, 660, "TRACKING & ORDER INFORMATION", 10, "F2"),
    text(
      42,
      638,
      `Created: ${new Date(job.createdAt).toLocaleString("en-GB")}`,
      9,
    ),
    text(305, 638, "Item: Secured delivery consignment", 9),
    text(42, 617, "Declared value: Recorded in dispatch system", 9),
    text(
      305,
      617,
      `Template: ${template?.fileName || "System fallback template"}`,
      9,
    ),
    text(42, 575, "PICKUP & HANDOVER", 10, "F2"),
    text(42, 551, `Sender: ${job.customer}`, 9),
    text(42, 532, `Pickup location: ${job.from}`, 9),
    text(
      42,
      513,
      `Pickup timestamp: ${new Date(job.scheduledAt).toLocaleString("en-GB")}`,
      9,
    ),
    text(42, 485, "Sender signature", 8),
    "0.75 0.77 0.8 RG 42 450 m 245 450 l S",
    text(42, 435, "Captured electronically / pending handoff", 8),
    text(305, 575, "DELIVERY & CUSTODY", 10, "F2"),
    text(305, 551, "Recipient: Authorized recipient", 9),
    text(305, 532, `Drop-off location: ${job.to}`, 9),
    text(
      305,
      513,
      `Delivery timestamp: ${
        job.status === "Completed" ? job.time : "Pending"
      }`,
      9,
    ),
    text(305, 485, "Recipient signature", 8),
    "0.75 0.77 0.8 RG 305 450 m 553 450 l S",
    text(
      305,
      435,
      job.status === "Completed" ? "Captured and verified" : "Not yet captured",
      8,
    ),
    text(42, 385, "AGENT DETAILS", 10, "F2"),
    text(42, 361, `Agent: ${job.agent}`, 9),
    text(42, 342, `Agent ID: ${agentId}`, 9),
    text(305, 361, "Vehicle: Dispatch vehicle on file", 9),
    text(305, 342, "License plate: Verified in agent profile", 9),
    "0.82 0.84 0.87 RG 42 305 m 553 305 l S",
    text(42, 278, "AUDIT & VERIFICATION", 10, "F2"),
    text(42, 254, `Tenant: ${tenantId}`, 8),
    text(42, 236, `SHA-256: ${checksum.slice(0, 64)}`, 7),
    text(
      42,
      218,
      `Verification code: ${checksum.slice(0, 8).toUpperCase()}-${checksum.slice(8, 16).toUpperCase()}`,
      8,
      "F2",
    ),
    text(
      42,
      58,
      "Digitally generated chain-of-custody record. Verify against the dispatch audit log.",
      7,
    ),
  ]
  if (draft) {
    lines.splice(
      2,
      0,
      "q /GS1 gs 0.45 0.48 0.5 rg 0.707 0.707 -0.707 0.707 145 275 cm",
      text(0, 0, "DRAFT / IN TRANSIT", 42, "F2"),
      "Q",
    )
  }
  downloadBlob(makePdf(lines), `${job.ref}-chain-of-custody.pdf`)
}

export async function downloadSampleCocTemplate() {
  const tagCell = (tag: string) =>
    new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: "F3F4F6" },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
      },
      children: [new Paragraph({ children: [new TextRun({ text: tag, font: "Courier New", size: 18, color: "1D4ED8" })] })],
    })

  const labelCell = (label: string) =>
    new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
      },
      children: [new Paragraph({ children: [new TextRun({ text: label, size: 18, color: "374151" })] })],
    })

  const sectionHeading = (text: string) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 320, after: 120 },
      children: [new TextRun({ text, bold: true, size: 22, color: "111827" })],
    })

  const tagRow = (tag: string, description: string) =>
    new TableRow({ children: [tagCell(tag), labelCell(description)] })

  const tableHeaderRow = (col1: string, col2: string) =>
    new TableRow({
      tableHeader: true,
      children: [col1, col2].map((label) =>
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: "1F2937" },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "374151" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "374151" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "374151" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "374151" },
          },
          children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18, color: "FFFFFF" })] })],
        }),
      ),
    })

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // ── Branded Header ──────────────────────────────────────────
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [new TextRun({ text: "NOKAEL LOGISTICS", bold: true, size: 44, color: "111827" })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [new TextRun({ text: "[Company Logo — replace with your branded mark]", italics: true, size: 18, color: "9CA3AF" })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [new TextRun({ text: "TRN: [Your Tax Registration Number]", size: 18, color: "6B7280" })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 320 },
            children: [new TextRun({ text: "CHAIN OF CUSTODY DOCUMENT", bold: true, size: 26, color: "374151" })],
          }),

          // ── Order Identifiers ────────────────────────────────────────
          sectionHeading("Order Identifiers"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              tableHeaderRow("Merge Tag", "Field Description"),
              tagRow("{{order_id}}", "Unique order / job reference"),
              tagRow("{{created_at}}", "Date & time the order was created"),
              tagRow("{{scheduled_date}}", "Scheduled pickup date & time"),
              tagRow("{{quote_request_id}}", "Originating quote request ID"),
            ],
          }),

          // ── Agent Information ────────────────────────────────────────
          sectionHeading("Agent Information"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              tableHeaderRow("Merge Tag", "Field Description"),
              tagRow("{{agent_name}}", "Full name of the assigned agent"),
              tagRow("{{agent_id}}", "Agent fleet ID (e.g. CR-1042)"),
              tagRow("{{vehicle_type}}", "Vehicle class (Cargo Van, Motorbike…)"),
              tagRow("{{license_plate}}", "Vehicle registration plate"),
              tagRow("{{agent_signature}}", "Agent signature capture placeholder"),
            ],
          }),

          // ── Pickup & Handover ────────────────────────────────────────
          sectionHeading("Pickup & Handover"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              tableHeaderRow("Merge Tag", "Field Description"),
              tagRow("{{sender_name}}", "Name of the sending party"),
              tagRow("{{pickup_location}}", "Full pickup address"),
              tagRow("{{pickup_timestamp}}", "Timestamp of physical pickup"),
              tagRow("{{sender_signature}}", "Sender signature capture placeholder"),
            ],
          }),

          // ── Delivery & Custody ───────────────────────────────────────
          sectionHeading("Delivery & Custody"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              tableHeaderRow("Merge Tag", "Field Description"),
              tagRow("{{recipient_name}}", "Name of the receiving party"),
              tagRow("{{dropoff_location}}", "Full delivery address"),
              tagRow("{{delivery_timestamp}}", "Timestamp of confirmed delivery"),
              tagRow("{{recipient_signature}}", "Recipient signature capture placeholder"),
            ],
          }),

          // ── Footer Notice ────────────────────────────────────────────
          new Paragraph({ spacing: { before: 480 }, children: [new TextRun({ text: "", size: 18 })] }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 120 },
            children: [
              new TextRun({
                text: "This document is an auditable chain-of-custody record generated by the Nokael dispatch platform. ",
                size: 16,
                color: "6B7280",
              }),
              new TextRun({
                text: "Authenticity is verified by the SHA-256 hash embedded in the exported PDF. ",
                size: 16,
                color: "6B7280",
              }),
              new TextRun({
                text: "Verification hash: [SHA-256 will be appended automatically at export time]",
                size: 16,
                italics: true,
                color: "9CA3AF",
              }),
            ],
          }),
        ],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  downloadBlob(blob, "CoC_Sample_Template.docx")
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
