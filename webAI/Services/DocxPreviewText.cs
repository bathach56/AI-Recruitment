using System.IO.Compression;
using System.Text;
using System.Xml;

namespace webAI.Services;

// Uploaded XML is data, including when it came from an older stored document.
public static class DocxPreviewText
{
    public const int MaxCharacters = 100000;
    public const int MaxDepth = 128;
    private const string Word = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

    public static string Read(byte[] bytes)
    {
        using var data = new MemoryStream(bytes);
        using var zip = new ZipArchive(data, ZipArchiveMode.Read);
        if (zip.Entries.Count > 2000 || zip.Entries.Sum(e => e.Length) > 50L * 1024 * 1024)
            throw new InvalidDataException("DOCX vượt giới hạn giải nén.");
        var entry = zip.GetEntry("word/document.xml") ?? throw new InvalidDataException("Thiếu nội dung DOCX.");
        using var stream = entry.Open();
        using var reader = XmlReader.Create(stream, new XmlReaderSettings {
            DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null,
            MaxCharactersInDocument = 50L * 1024 * 1024
        });
        var output = new StringBuilder();
        var buffer = new char[2048];
        int body = -1, text = -1;
        var paragraphs = new Stack<int>();
        bool first = true;
        void Append(ReadOnlySpan<char> value) {
            if (value.Length > MaxCharacters - output.Length)
                throw new InvalidDataException("Văn bản DOCX vượt giới hạn xem trước.");
            output.Append(value);
        }
        while (reader.Read()) {
            if (reader.Depth > MaxDepth) throw new InvalidDataException("DOCX lồng quá nhiều cấp.");
            if (reader.NodeType == XmlNodeType.Element && reader.NamespaceURI == Word) {
                if (reader.LocalName == "body") {
                    if (body >= 0) throw new InvalidDataException("Cấu trúc DOCX không hợp lệ.");
                    if (!reader.IsEmptyElement) body = reader.Depth;
                } else if (reader.LocalName == "p" && body >= 0) {
                    if (!first) Append("\n");
                    first = false;
                    if (!reader.IsEmptyElement) paragraphs.Push(reader.Depth);
                } else if (reader.LocalName == "t" && paragraphs.Count > 0 && !reader.IsEmptyElement) {
                    text = reader.Depth;
                }
            } else if (reader.NodeType == XmlNodeType.EndElement) {
                if (reader.Depth == text) text = -1;
                if (paragraphs.TryPeek(out var depth) && reader.Depth == depth) paragraphs.Pop();
                if (reader.Depth == body) body = -1;
            } else if (text >= 0 && reader.NodeType is XmlNodeType.Text or XmlNodeType.CDATA or XmlNodeType.SignificantWhitespace or XmlNodeType.Whitespace) {
                int count;
                while ((count = reader.ReadValueChunk(buffer, 0, buffer.Length)) > 0) Append(buffer.AsSpan(0, count));
            }
        }
        return output.ToString();
    }
}
