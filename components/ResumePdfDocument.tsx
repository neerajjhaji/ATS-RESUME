import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { getTemplate, type ResumeTemplate, type TemplateId } from "@/lib/templates";

/**
 * A single-column, ATS-parsable PDF rendered in the chosen template style.
 * The first non-empty line is treated as the candidate's name; ALL-CAPS short
 * lines become section headers; "- " lines become bullets. No tables, no
 * columns, no graphics — safe for real ATS parsers in every template.
 */

function isHeader(line: string): boolean {
  const t = line.trim();
  if (t.length < 2 || t.length > 40) return false;
  const letters = t.replace(/[^a-zA-Z]/g, "");
  if (!letters) return false;
  const upper = t.replace(/[^A-Z]/g, "").length;
  return upper / letters.length > 0.8;
}

function buildStyles(t: ResumeTemplate) {
  const headerBase = {
    fontSize: t.fontSize + 1.5,
    fontFamily: t.bold,
    marginTop: t.sectionGap,
    marginBottom: 4,
    color: t.header === "accent" || t.header === "band" ? t.accent : "#111827",
  } as const;

  return StyleSheet.create({
    page: {
      paddingVertical: 40,
      paddingHorizontal: 46,
      fontSize: t.fontSize,
      fontFamily: t.base,
      lineHeight: t.lineHeight,
      color: "#1f2937",
    },
    name: {
      fontSize: t.fontSize + 8,
      fontFamily: t.bold,
      color: t.accent,
      textAlign: t.nameAlign,
      marginBottom: 6,
      letterSpacing: t.header === "smallcaps" ? 1 : 0.2,
    },
    headerUnderline: {
      ...headerBase,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      borderBottom: `1px solid ${t.accent}`,
      paddingBottom: 2,
    },
    headerAccent: { ...headerBase, textTransform: "uppercase", letterSpacing: 0.6 },
    headerRule: {
      ...headerBase,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      borderTop: "0.75px solid #cbd5e1",
      paddingTop: 3,
    },
    headerSmallcaps: {
      ...headerBase,
      textTransform: "uppercase",
      letterSpacing: 2,
      textAlign: "center",
    },
    headerPlain: { ...headerBase, textTransform: "uppercase", letterSpacing: 2.5 },
    bandRow: { flexDirection: "row", alignItems: "center", marginTop: t.sectionGap, marginBottom: 4 },
    bandBar: { width: 3, height: t.fontSize + 3, backgroundColor: t.accent, marginRight: 6 },
    bandText: {
      fontSize: t.fontSize + 1.5,
      fontFamily: t.bold,
      color: t.accent,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    bulletRow: { flexDirection: "row", marginBottom: 2 },
    bulletDot: { width: 10, color: t.accent },
    bulletText: { flex: 1 },
    line: { marginBottom: 2 },
  });
}

export function ResumePdfDocument({
  text,
  templateId = "classic",
}: {
  text: string;
  templateId?: TemplateId;
}) {
  const t = getTemplate(templateId);
  const s = buildStyles(t);
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let nameDone = false;

  function renderHeader(label: string, key: number) {
    if (t.header === "band") {
      return (
        <View key={key} style={s.bandRow} wrap={false}>
          <View style={s.bandBar} />
          <Text style={s.bandText}>{label}</Text>
        </View>
      );
    }
    const style =
      t.header === "accent"
        ? s.headerAccent
        : t.header === "rule"
        ? s.headerRule
        : t.header === "smallcaps"
        ? s.headerSmallcaps
        : t.header === "plain"
        ? s.headerPlain
        : s.headerUnderline;
    return (
      <Text key={key} style={style}>
        {label}
      </Text>
    );
  }

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {lines.map((line, i) => {
          const trimmed = line.trim();
          if (!trimmed) return <View key={i} style={{ height: 5 }} />;

          if (!nameDone) {
            nameDone = true;
            return (
              <Text key={i} style={s.name}>
                {trimmed}
              </Text>
            );
          }

          if (isHeader(trimmed)) return renderHeader(trimmed, i);

          if (/^[-*•]\s+/.test(trimmed)) {
            return (
              <View key={i} style={s.bulletRow}>
                <Text style={s.bulletDot}>•</Text>
                <Text style={s.bulletText}>{trimmed.replace(/^[-*•]\s+/, "")}</Text>
              </View>
            );
          }

          return (
            <Text key={i} style={s.line}>
              {trimmed}
            </Text>
          );
        })}
      </Page>
    </Document>
  );
}
