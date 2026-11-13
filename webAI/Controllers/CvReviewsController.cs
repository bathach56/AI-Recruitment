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
public class CvReviewsController(RecruitmentDbContext db,CvReviewService service,CvReviewQueue queue):ControllerBase
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
        try{
            if(requestJson.Length>5*1024*1024)return BadRequest();
            var request=JsonSerializer.Deserialize<ReviewCreateRequest>(requestJson,CvReviewService.Json)??throw new ArgumentException("Thiếu dữ liệu.");
            await using var transaction=await db.Database.BeginTransactionAsync();
            var company=await CompanyId();var batch=await service.CreateAsync(company,request,Request.Form.Files);
            if(request.RunInBackground)await queue.EnqueueAsync(batch.Id,company);
            await transaction.CommitAsync();return Ok(new{batch.Id});
        }
        catch(Exception ex) when(ex is ArgumentException or JsonException){return BadRequest(new{message=ex is ArgumentException?ex.Message:"Dữ liệu đợt xét không hợp lệ."});}
    }
    [HttpGet]
    public async Task<IActionResult> List(bool includeArchived=false,string? q=null,DateTimeOffset? from=null,DateTimeOffset? to=null)
    {
        if(q?.Length>200||(from.HasValue&&to.HasValue&&from.Value>=to.Value))return BadRequest(new{message="Tên tìm kiếm hoặc khoảng ngày không hợp lệ."});
        var company=await CompanyId();var batches=db.CvReviewBatches.AsNoTracking().Where(b=>b.CompanyId==company&&(includeArchived||!b.Title.StartsWith("[Lưu trữ]")));
        if(!string.IsNullOrWhiteSpace(q)){var term=q.Trim().Replace('đ','d').Replace('Đ','D');batches=batches.Where(b=>EF.Functions.Collate(b.Title.Replace("đ","d").Replace("Đ","D"),"Latin1_General_100_CI_AI").Contains(term));}
        if(from.HasValue)batches=batches.Where(b=>b.CreatedAt>=from.Value);
        if(to.HasValue)batches=batches.Where(b=>b.CreatedAt<to.Value);
        return Ok(await batches.OrderByDescending(b=>b.CreatedAt).ThenBy(b=>b.Id).Select(b=>new{b.Id,b.Title,b.Model,b.CreatedAt,b.QueueState,total=db.CvReviewItems.Count(i=>i.BatchId==b.Id),completed=db.CvReviewItems.Count(i=>i.BatchId==b.Id&&(i.State=="Complete"||i.State=="Incomplete")),errors=db.CvReviewItems.Count(i=>i.BatchId==b.Id&&i.State=="Error")}).Take(200).ToListAsync());
    }
    private IQueryable<CvReviewItem> Filter(Guid id,string? q,string? state,double? min,string? sort)
    {
        var items=db.CvReviewItems.AsNoTracking().Where(i=>i.BatchId==id);
        if(!string.IsNullOrWhiteSpace(q)){var term=q.Trim().Replace('đ','d').Replace('Đ','D');items=items.Where(i=>EF.Functions.Collate(i.Name.Replace("đ","d").Replace("Đ","D"),"Latin1_General_100_CI_AI").Contains(term)||EF.Functions.Collate(i.Email.Replace("đ","d").Replace("Đ","D"),"Latin1_General_100_CI_AI").Contains(term));}
        if(!string.IsNullOrWhiteSpace(state)&&state!="all")items=items.Where(i=>i.State==state);
        if(min.HasValue)items=items.Where(i=>i.Score>=min.Value);
        return sort=="semantic-desc"?items.OrderBy(i=>i.SemanticScore==null).ThenByDescending(i=>i.SemanticScore).ThenBy(i=>i.Id)
            :sort=="semantic-asc"?items.OrderBy(i=>i.SemanticScore==null).ThenBy(i=>i.SemanticScore).ThenBy(i=>i.Id)
            :sort=="asc"?items.OrderBy(i=>i.Score==null).ThenBy(i=>i.Score).ThenBy(i=>i.Id):sort=="name"?items.OrderBy(i=>i.Name).ThenBy(i=>i.Id):items.OrderBy(i=>i.Score==null).ThenByDescending(i=>i.Score).ThenBy(i=>i.Id);
    }
    private static object Row(CvReviewItem i)=>new{i.Id,i.BatchId,i.Name,i.Email,i.Source,i.FileName,i.State,i.Error,i.Score,i.SemanticScore,i.SkillScore,i.ExperienceScore,i.AnalyzedAt,result=string.IsNullOrEmpty(i.ResultJson)?(JsonElement?)null:JsonSerializer.Deserialize<JsonElement>(i.ResultJson)};
    private async Task<CvReviewItem?> OwnedItem(Guid id,int itemId)
    {
        var company=await CompanyId();return await (from item in db.CvReviewItems.AsNoTracking() join batch in db.CvReviewBatches.AsNoTracking() on item.BatchId equals batch.Id where batch.Id==id&&batch.CompanyId==company&&item.Id==itemId select item).SingleOrDefaultAsync();
    }
    [HttpGet("{id:guid}/items/{itemId:int}/document")]
    public async Task<IActionResult> Document(Guid id,int itemId,bool inline=false)
    {
        var item=await OwnedItem(id,itemId);if(item==null||string.IsNullOrEmpty(item.StorageKey))return NotFound();
        var bytes=await db.Documents.AsNoTracking().Where(d=>d.StorageKey==item.StorageKey).Select(d=>d.Data).SingleOrDefaultAsync();if(bytes==null)return NotFound();
        var pdf=item.StorageKey.EndsWith(".pdf",StringComparison.OrdinalIgnoreCase);var docx=item.StorageKey.EndsWith(".docx",StringComparison.OrdinalIgnoreCase);if(!pdf&&!docx)return BadRequest();
        var type=pdf?"application/pdf":"application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        return inline&&pdf?File(bytes,type,enableRangeProcessing:true):File(bytes,type,Path.GetFileName(string.IsNullOrWhiteSpace(item.FileName)?"ho-so"+(pdf?".pdf":".docx"):item.FileName));
    }
    [HttpGet("{id:guid}/items/{itemId:int}/preview")]
    public async Task<IActionResult> Preview(Guid id,int itemId)
    {
        var item=await OwnedItem(id,itemId);if(item==null)return NotFound();
        if(string.IsNullOrEmpty(item.StorageKey))return string.IsNullOrWhiteSpace(item.CvText)?NotFound(new{message="Không có nội dung CV đã lưu."}):Ok(new{kind="text",text=item.CvText,note="Nội dung CV đã nhập qua Excel hoặc văn bản; không có tệp gốc."});
        var document=await Document(id,itemId,true);if(document is not FileContentResult file)return document;
        if(file.ContentType=="application/pdf")return Ok(new{kind="pdf",url=$"/api/recruiter/reviews/{id}/items/{itemId}/document?inline=true",downloadUrl=$"/api/recruiter/reviews/{id}/items/{itemId}/document"});
        try{
            var text=DocxPreviewText.Read(file.FileContents);
            if(string.IsNullOrWhiteSpace(text))return BadRequest(new{message="DOCX không có văn bản đọc được. Hãy tải tệp gốc để xem."});
            return Ok(new{kind="text",text,downloadUrl=$"/api/recruiter/reviews/{id}/items/{itemId}/document",note="Văn bản DOCX; tải tệp gốc để xem đầy đủ định dạng và hình ảnh."});
        }catch(Exception ex) when(ex is InvalidDataException or XmlException or IOException){return BadRequest(new{message="Không đọc được CV đã lưu. Hãy tải tệp gốc để kiểm tra."});}
    }
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Detail(Guid id,string? q=null,string? state=null,double? min=null,string? sort=null)
    {
        if(min.HasValue&&(!double.IsFinite(min.Value)||min<0||min>100))return BadRequest();
        var company=await CompanyId();var batch=await db.CvReviewBatches.AsNoTracking().SingleOrDefaultAsync(b=>b.Id==id&&b.CompanyId==company);if(batch==null)return NotFound();
        return Ok(new{batch.Id,batch.Title,batch.Model,batch.CreatedAt,batch.QueueState,
            total=await db.CvReviewItems.CountAsync(i=>i.BatchId==id),
            completed=await db.CvReviewItems.CountAsync(i=>i.BatchId==id&&(i.State=="Complete"||i.State=="Incomplete")),
            errors=await db.CvReviewItems.CountAsync(i=>i.BatchId==id&&i.State=="Error"),
            configuration=JsonSerializer.Deserialize<JsonElement>(batch.ConfigurationJson),items=(await Filter(id,q,state,min,sort).ToListAsync()).Select(Row)});
    }
    [HttpPost("{id:guid}/queue")]
    public async Task<IActionResult> Enqueue(Guid id) => await queue.EnqueueAsync(id,await CompanyId())
        ? Ok(new { message="Đã đưa vào hàng đợi SQL. Có thể đóng trang; máy chủ sẽ tiếp tục xử lý." }) : NotFound();
    [HttpPost("{id:guid}/pause")]
    public async Task<IActionResult> Pause(Guid id) => await queue.PauseAsync(id,await CompanyId())
        ? Ok(new { message="Đã tạm dừng nhận hồ sơ tiếp theo. Hồ sơ đang xét sẽ được lưu khi hoàn tất." }) : NotFound();
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
        var rows=items.Select(i=>new object?[]{i.Name,i.Email,Source(i.Source),batch.Title,batch.Model=="Hybrid"?"Kết hợp":batch.Model,State(i.State),i.Score,i.SemanticScore,i.SkillScore,i.ExperienceScore,i.Error,i.AnalyzedAt?.ToString("O"),"Điểm CV-JD hỗ trợ rà soát; không phải độ chính xác hoặc quyết định tuyển dụng."}).ToList();
        return File(ReviewWorkbook.Write(["Ứng viên / CV","Email","Nguồn","Vị trí / JD","Phương pháp","Trạng thái","Điểm phù hợp (0-100)","Ngữ nghĩa / từ vựng (0-100)","Kỹ năng (0-100)","Kinh nghiệm (0-100)","Lỗi / ghi chú","Thời điểm xét (UTC)","Lưu ý"],rows),Xlsx,$"ket-qua-cv-{id:N}.xlsx");
    }
}
