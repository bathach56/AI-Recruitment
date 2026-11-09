using System.Security.Claims;
using System.Text.Json;
using System.Xml;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using webAI.Data;
using webAI.Services;

namespace webAI.Controllers;

[ApiController,Route("api/recruiter/reviews"),Authorize(Roles="Recruiter"),AutoValidateAntiforgeryToken]
public class CvReviewsController(RecruitmentDbContext db,CvReviewService service):ControllerBase
{
    private const string Xlsx="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private Task<int> CompanyId()=>db.Companies.Where(c=>c.OwnerSubject==User.FindFirstValue(ClaimTypes.NameIdentifier)).Select(c=>c.Id).SingleAsync();
    [HttpGet("excel-template")]
    public IActionResult Template()=>File(ReviewWorkbook.Write(ReviewWorkbook.ImportHeaders,[]),Xlsx,"mau-nhap-cv.xlsx");
    [HttpPost("import-excel"),RequestSizeLimit(12*1024*1024)]
    public async Task<IActionResult> Import(IFormFile file){try{return Ok(await ReviewWorkbook.ReadAsync(file));}catch(Exception ex) when(ex is ArgumentException or InvalidDataException or XmlException){return BadRequest(new{message=ex is ArgumentException?ex.Message:"File Excel bị hỏng hoặc không được hỗ trợ."});}}

    [HttpPost,RequestSizeLimit(110*1024*1024),RequestFormLimits(MultipartBodyLengthLimit=110*1024*1024,ValueLengthLimit=5*1024*1024)]
    public async Task<IActionResult> Create([FromForm]string requestJson)
    {
        try{if(requestJson.Length>5*1024*1024)return BadRequest();var request=JsonSerializer.Deserialize<ReviewCreateRequest>(requestJson,CvReviewService.Json)??throw new ArgumentException("Thiếu dữ liệu.");var batch=await service.CreateAsync(await CompanyId(),request,Request.Form.Files);return Ok(new{batch.Id});}
        catch(Exception ex) when(ex is ArgumentException or JsonException){return BadRequest(new{message=ex is ArgumentException?ex.Message:"Dữ liệu đợt xét không hợp lệ."});}
    }
    [HttpGet]
    public async Task<IActionResult> List(){var company=await CompanyId();return Ok(await db.CvReviewBatches.Where(b=>b.CompanyId==company).OrderByDescending(b=>b.CreatedAt).Select(b=>new{b.Id,b.Title,b.Model,b.CreatedAt,total=db.CvReviewItems.Count(i=>i.BatchId==b.Id),completed=db.CvReviewItems.Count(i=>i.BatchId==b.Id&&(i.State=="Complete"||i.State=="Incomplete")),errors=db.CvReviewItems.Count(i=>i.BatchId==b.Id&&i.State=="Error")}).Take(200).ToListAsync());}
    private IQueryable<CvReviewItem> Filter(Guid id,string? q,string? state,double? min,string? sort)
    {
        var items=db.CvReviewItems.AsNoTracking().Where(i=>i.BatchId==id);
        if(!string.IsNullOrWhiteSpace(q))items=items.Where(i=>i.Name.Contains(q)||i.Email.Contains(q));
        if(!string.IsNullOrWhiteSpace(state)&&state!="all")items=items.Where(i=>i.State==state);
        if(min.HasValue)items=items.Where(i=>i.Score>=min.Value);
        return sort=="semantic-desc"?items.OrderBy(i=>i.SemanticScore==null).ThenByDescending(i=>i.SemanticScore).ThenBy(i=>i.Id)
            :sort=="semantic-asc"?items.OrderBy(i=>i.SemanticScore==null).ThenBy(i=>i.SemanticScore).ThenBy(i=>i.Id)
            :sort=="asc"?items.OrderBy(i=>i.Score==null).ThenBy(i=>i.Score).ThenBy(i=>i.Id):sort=="name"?items.OrderBy(i=>i.Name).ThenBy(i=>i.Id):items.OrderBy(i=>i.Score==null).ThenByDescending(i=>i.Score).ThenBy(i=>i.Id);
    }
    private static object Row(CvReviewItem i)=>new{i.Id,i.BatchId,i.Name,i.Email,i.Source,i.FileName,i.State,i.Error,i.Score,i.SemanticScore,i.SkillScore,i.ExperienceScore,i.AnalyzedAt,result=string.IsNullOrEmpty(i.ResultJson)?(JsonElement?)null:JsonSerializer.Deserialize<JsonElement>(i.ResultJson)};
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Detail(Guid id,string? q=null,string? state=null,double? min=null,string? sort=null)
    {
        if(min.HasValue&&(!double.IsFinite(min.Value)||min<0||min>100))return BadRequest();
        var company=await CompanyId();var batch=await db.CvReviewBatches.AsNoTracking().SingleOrDefaultAsync(b=>b.Id==id&&b.CompanyId==company);if(batch==null)return NotFound();
        return Ok(new{batch.Id,batch.Title,batch.Model,batch.CreatedAt,configuration=JsonSerializer.Deserialize<JsonElement>(batch.ConfigurationJson),items=(await Filter(id,q,state,min,sort).ToListAsync()).Select(Row)});
    }
    [HttpPost("{id:guid}/items/{itemId:int}/analyze")]
    public async Task<IActionResult> Analyze(Guid id,int itemId,CancellationToken ct){try{var item=await service.AnalyzeAsync(id,itemId,await CompanyId(),ct);return item==null?NotFound():Ok(Row(item));}catch(InvalidOperationException){return Conflict(new{message="Hồ sơ đang được xử lý. Thử lại sau."});}}
    [HttpGet("{id:guid}/excel")]
    public async Task<IActionResult> Export(Guid id,string? q=null,string? state=null,double? min=null,string? sort=null)
    {
        if(min.HasValue&&(!double.IsFinite(min.Value)||min<0||min>100))return BadRequest();
        var company=await CompanyId();var batch=await db.CvReviewBatches.AsNoTracking().SingleOrDefaultAsync(b=>b.Id==id&&b.CompanyId==company);if(batch==null)return NotFound();
        var items=await Filter(id,q,state,min,sort).ToListAsync();
        string State(string state)=>state switch{"Complete"=>"Có điểm tổng","Incomplete"=>"Thiếu dữ liệu tính tổng","Error"=>"Lỗi","Running"=>"Đang xét",_=>"Chưa xét"};
        string Source(string source)=>source switch{"Application"=>"Ứng tuyển","Upload"=>"Tệp tải lên",_=>"Excel / văn bản"};
        var rows=items.Select(i=>new object?[]{i.Name,i.Email,Source(i.Source),batch.Title,batch.Model,State(i.State),i.Score,i.SemanticScore,i.SkillScore,i.ExperienceScore,i.Error,i.AnalyzedAt?.ToString("O"),"Điểm CV-JD hỗ trợ rà soát; không phải độ chính xác hoặc quyết định tuyển dụng."}).ToList();
        return File(ReviewWorkbook.Write(["Ứng viên / CV","Email","Nguồn","Vị trí / JD","Phương pháp","Trạng thái","Điểm phù hợp (0-100)","Ngữ nghĩa / từ vựng (0-100)","Kỹ năng (0-100)","Kinh nghiệm (0-100)","Lỗi / ghi chú","Thời điểm xét (UTC)","Lưu ý"],rows),Xlsx,$"ket-qua-cv-{id:N}.xlsx");
    }
}
