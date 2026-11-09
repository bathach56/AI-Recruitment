using System.Globalization;
using System.IO.Compression;
using System.Xml;
using System.Xml.Linq;

namespace webAI.Services;

// Small XLSX codec for this application's fixed, text-only import contract.
// No formulas, remote links, macros or arbitrary workbook execution.
public static class ReviewWorkbook
{
    private static readonly XNamespace S = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    private static readonly XNamespace R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    public static readonly string[] ImportHeaders = ["Tên ứng viên", "Email", "Nội dung CV"];
    private static readonly string[] LegacyImportHeaders = ["candidate_name", "email", "cv_text"];
    public static byte[] Write(string[] headers, IReadOnlyList<object?[]> rows)
    {
        using var data = new MemoryStream();
        using (var zip = new ZipArchive(data, ZipArchiveMode.Create, true))
        {
            void Xml(string path, XDocument xml) { using var stream = zip.CreateEntry(path).Open(); xml.Save(stream); }
            XNamespace p = "http://schemas.openxmlformats.org/package/2006/relationships";
            XNamespace ct = "http://schemas.openxmlformats.org/package/2006/content-types";
            Xml("[Content_Types].xml", new(new XElement(ct+"Types",
                new XElement(ct+"Default",new XAttribute("Extension","rels"),new XAttribute("ContentType","application/vnd.openxmlformats-package.relationships+xml")),
                new XElement(ct+"Default",new XAttribute("Extension","xml"),new XAttribute("ContentType","application/xml")),
                new[]{("/xl/workbook.xml","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"),("/xl/worksheets/sheet1.xml","application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"),("/xl/styles.xml","application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml")}
                    .Select(x=>new XElement(ct+"Override",new XAttribute("PartName",x.Item1),new XAttribute("ContentType",x.Item2))))));
            XElement Rel(string id,string type,string target)=>new(p+"Relationship",new XAttribute("Id",id),new XAttribute("Type",R.NamespaceName+"/"+type),new XAttribute("Target",target));
            Xml("_rels/.rels",new(new XElement(p+"Relationships",Rel("rId1","officeDocument","xl/workbook.xml"))));
            Xml("xl/workbook.xml",new(new XElement(S+"workbook",new XAttribute(XNamespace.Xmlns+"r",R),new XElement(S+"sheets",new XElement(S+"sheet",new XAttribute("name","RecruitAI"),new XAttribute("sheetId",1),new XAttribute(R+"id","rId1"))))));
            Xml("xl/_rels/workbook.xml.rels",new(new XElement(p+"Relationships",Rel("rId1","worksheet","worksheets/sheet1.xml"),Rel("rId2","styles","styles.xml"))));
            Xml("xl/styles.xml",XDocument.Parse("""
                <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1458E8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>
                """));
            string Column(int n) { var value=""; do {value=(char)('A'+n%26)+value;n=n/26-1;}while(n>=0);return value; }
            XElement Row(int index, object?[] values, bool header=false)=>new(S+"row",new XAttribute("r",index),header?new XAttribute("ht",44):null,header?new XAttribute("customHeight",1):null,
                values.Select((value,i)=>{
                    var cell=new XElement(S+"c",new XAttribute("r",Column(i)+index),new XAttribute("s",header?1:2));
                    if(value is double or int or decimal)cell.Add(new XElement(S+"v",Convert.ToString(value,CultureInfo.InvariantCulture)));
                    else if(value!=null){var text=new System.Text.StringBuilder();foreach(var rune in value.ToString()!.EnumerateRunes()){if(text.Length+rune.Utf16SequenceLength>32767)break;if(rune.Value>=0x10000||XmlConvert.IsXmlChar((char)rune.Value))text.Append(rune.ToString());}cell.Add(new XAttribute("t","inlineStr"),new XElement(S+"is",new XElement(S+"t",new XAttribute(XNamespace.Xml+"space","preserve"),text.ToString())));}
                    return cell;
                }));
            var sheet=new XElement(S+"worksheet",new XElement(S+"sheetViews",new XElement(S+"sheetView",new XAttribute("workbookViewId",0),new XElement(S+"pane",new XAttribute("ySplit",1),new XAttribute("topLeftCell","A2"),new XAttribute("state","frozen")))),
                new XElement(S+"cols",headers.Select((h,i)=>new XElement(S+"col",new XAttribute("min",i+1),new XAttribute("max",i+1),new XAttribute("width",h=="cv_text"?95:i==0?34:24),new XAttribute("customWidth",1)))),
                new XElement(S+"sheetData",Row(1,headers.Cast<object?>().ToArray(),true),rows.Select((row,i)=>Row(i+2,row))),
                new XElement(S+"autoFilter",new XAttribute("ref","A1:"+Column(headers.Length-1)+(rows.Count+1))));
            Xml("xl/worksheets/sheet1.xml",new(sheet));
        }
        return data.ToArray();
    }

    public static async Task<List<ExternalCvRow>> ReadAsync(IFormFile file)
    {
        if(Path.GetExtension(file.FileName).ToLowerInvariant()!=".xlsx"||file.Length is <=0 or >10485760)throw new ArgumentException("Chọn file .xlsx tối đa 10 MiB theo mẫu.");
        using var input=file.OpenReadStream();using var zip=new ZipArchive(input,ZipArchiveMode.Read);
        if(zip.Entries.Count>500||zip.Entries.Sum(e=>e.Length)>20*1024*1024||zip.Entries.Any(e=>e.FullName.Contains("vbaProject",StringComparison.OrdinalIgnoreCase)||e.FullName.StartsWith("xl/externalLinks/",StringComparison.OrdinalIgnoreCase)))throw new ArgumentException("Sổ làm việc quá lớn hoặc có macro/liên kết ngoài không được hỗ trợ.");
        XDocument Read(string path){var entry=zip.GetEntry(path)??throw new ArgumentException("Sổ làm việc thiếu cấu trúc cần thiết.");using var stream=entry.Open();using var reader=XmlReader.Create(stream,new XmlReaderSettings{DtdProcessing=DtdProcessing.Prohibit,XmlResolver=null,MaxCharactersInDocument=20*1024*1024});return XDocument.Load(reader);}
        var workbook=Read("xl/workbook.xml");var sheet=workbook.Descendants(S+"sheet").FirstOrDefault()??throw new ArgumentException("Sổ làm việc không có trang tính.");
        var relations=Read("xl/_rels/workbook.xml.rels").Root!.Elements().Where(e=>(string?)e.Attribute("Id")== (string?)sheet.Attribute(R+"id")).ToArray();
        if(relations.Length!=1)throw new ArgumentException("Liên kết trang tính trong sổ làm việc không hợp lệ.");var relation=relations[0];
        var target=(string?)relation?.Attribute("Target")??"";
        if((string?)relation?.Attribute("TargetMode")=="External")throw new ArgumentException("Không đọc liên kết ngoài.");
        target=target.StartsWith('/')?target.TrimStart('/') : "xl/"+target;
        if(!target.StartsWith("xl/worksheets/")||target.Contains(".."))throw new ArgumentException("Đường dẫn trang tính không được hỗ trợ.");
        var strings=zip.GetEntry("xl/sharedStrings.xml")==null?[]:Read("xl/sharedStrings.xml").Descendants(S+"si").Select(e=>string.Concat(e.Descendants(S+"t").Select(t=>t.Value))).ToArray();
        var rows=Read(target).Descendants(S+"row").ToList();if(rows.Count>1000)throw new ArgumentException("Tối đa 50 hồ sơ, không dùng vùng dữ liệu dư quá lớn.");
        string[] Values(XElement row){var result=new string[3];Array.Fill(result,"");foreach(var c in row.Elements(S+"c")){
            if(c.Element(S+"f")!=null)throw new ArgumentException("Mẫu nhập chỉ nhận văn bản, không nhận công thức.");
            var reference=(string?)c.Attribute("r")??"";var column=new string(reference.TakeWhile(char.IsLetter).ToArray());
            if(column is not ("A" or "B" or "C"))continue;var value=(string?)c.Element(S+"v")??"";var type=(string?)c.Attribute("t");
            if(type=="s"){if(!int.TryParse(value,out var i)||i<0||i>=strings.Length)throw new ArgumentException("Chuỗi dùng chung không hợp lệ.");value=strings[i];}
            else if(type=="inlineStr")value=string.Concat(c.Descendants(S+"t").Select(t=>t.Value));
            if(value.Length>32767)throw new ArgumentException("Mỗi ô tối đa 32.767 ký tự.");result[column[0]-'A']=value.Trim();}return result;}
        if(rows.Count==0||(!Values(rows[0]).SequenceEqual(ImportHeaders)&&!Values(rows[0]).SequenceEqual(LegacyImportHeaders)))throw new ArgumentException("Dòng đầu cần đúng ba cột: Tên ứng viên, Email, Nội dung CV. Hãy tải mẫu.");
        var output=new List<ExternalCvRow>();foreach(var row in rows.Skip(1)){var cells=Values(row);if(cells.All(string.IsNullOrWhiteSpace))continue;var cv=new ExternalCvRow{Name=cells[0],Email=cells[1],CvText=cells[2]};cv.Validate();output.Add(cv);}
        if(output.Count is <1 or >50)throw new ArgumentException("File cần từ 1 đến 50 hồ sơ có nội dung CV.");
        await Task.CompletedTask;return output;
    }
}
public class ExternalCvRow
{
    public string Name { get; set; }="";
    public string Email { get; set; }="";
    public string CvText { get; set; }="";
    public void Validate(){Email??="";if(string.IsNullOrWhiteSpace(Name)||Name.Length>200||Email.Length>150||(!string.IsNullOrEmpty(Email)&&!new System.ComponentModel.DataAnnotations.EmailAddressAttribute().IsValid(Email))||string.IsNullOrWhiteSpace(CvText)||CvText.Length>100000)throw new ArgumentException("Mỗi hồ sơ cần tên (tối đa 200 ký tự), email hợp lệ nếu có, và nội dung CV (tối đa 100.000 ký tự).");}
}
