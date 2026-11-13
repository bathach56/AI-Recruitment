using System.Text.Json;
using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using webAI.Data;
using webAI.Models;

namespace webAI.Services;

public class ReviewCreateRequest
{
    public int JobId { get; set; }
    public bool RunInBackground { get; set; }
    public AiMatchingRequest Configuration { get; set; } = new();
    public List<int> ApplicationIds { get; set; } = [];
    public List<ExternalCvRow> ExternalRows { get; set; } = [];
}
public class CvReviewService(RecruitmentDbContext db, PrivateDocumentStore files, IAiMatchingService ai, ILogger<CvReviewService> logger)
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public async Task<CvReviewBatch> CreateAsync(int companyId, ReviewCreateRequest request, IFormFileCollection uploads)
    {
        var config=request.Configuration??throw new ArgumentException("Thiếu cấu hình đối chiếu.");
        var job=await db.Jobs.AsNoTracking().SingleOrDefaultAsync(j=>j.Id==request.JobId&&j.CompanyId==companyId)
            ??throw new ArgumentException("Chọn tin tuyển dụng thuộc công ty của bạn.");
        // The stored job is authoritative. Only method/weights come from the client.
        config.JobId=job.Id;config.JobTitle=job.Title;
        config.JobDescription=string.Join("\n\n",new[]{job.Description,string.IsNullOrWhiteSpace(job.Requirements)?"":"Yêu cầu ứng viên:\n"+job.Requirements,string.IsNullOrWhiteSpace(job.Experience)?"":"Kinh nghiệm: "+job.Experience}.Where(s=>!string.IsNullOrWhiteSpace(s)));
        config.RequiredSkills=job.Skills.Split([',',';','\n'],StringSplitOptions.TrimEntries|StringSplitOptions.RemoveEmptyEntries).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        config.NiceToHaveSkills=[];config.JobExperienceYearsRequired=MinimumYears(job.Experience);
        if(string.IsNullOrWhiteSpace(config.JobDescription)||config.JobDescription.Length>100000||config.JobTitle==null||config.JobTitle.Length>500||config.ModelType is not ("Hybrid" or "TF-IDF" or "Sentence-BERT")||config.RequiredSkills==null||config.NiceToHaveSkills==null||config.RequiredSkills.Count>100||config.NiceToHaveSkills.Count>100||config.RequiredSkills.Concat(config.NiceToHaveSkills).Any(s=>string.IsNullOrWhiteSpace(s)||s.Length>200)||config.JobExperienceYearsRequired is <0 or >100)throw new ArgumentException("JD, phương pháp hoặc yêu cầu kỹ năng không hợp lệ.");
        var w=config.Weights??throw new ArgumentException("Thiếu trọng số.");
        var weights=new[]{w.SemanticWeight,w.SkillWeight,w.ExperienceWeight};
        if(weights.Any(v=>!double.IsFinite(v)||v<0||v>1)||weights.Sum()<=0)throw new ArgumentException("Trọng số không hợp lệ.");
        request.ApplicationIds??=[];request.ExternalRows??=[];
        var ids=request.ApplicationIds.Distinct().ToArray();
        var count=ids.Length+request.ExternalRows.Count+uploads.Count;
        if(count is <1 or >50||uploads.Sum(f=>f.Length)>100*1024*1024)throw new ArgumentException("Chọn từ 1 đến 50 CV, tổng tệp tải lên tối đa 100 MiB.");
        foreach(var row in request.ExternalRows){if(row==null)throw new ArgumentException("Hồ sơ trống.");row.Validate();}
        var applications=await (from a in db.Applications join j in db.Jobs on a.JobId equals j.Id
            join c in db.Candidates on a.CandidateId equals c.Id join r in db.Resumes on a.ResumeId equals r.Id
            where ids.Contains(a.Id)&&j.CompanyId==companyId&&j.Id==job.Id
            select new{a.Id,c.FullName,c.Email,r.Name,r.StorageKey}).ToListAsync();
        if(applications.Count!=ids.Length)throw new ArgumentException("Chỉ chọn hồ sơ ứng tuyển vào đúng tin tuyển dụng đang xét.");
        config.CvText="";config.CvSkills=[];config.CvExperienceYears=null;config.CvId=0;
        var batch=new CvReviewBatch{CompanyId=companyId,Title=string.IsNullOrWhiteSpace(config.JobTitle)?"Đợt đối chiếu CV":config.JobTitle,Model=config.ModelType,ConfigurationJson=JsonSerializer.Serialize(config,Json)};
        var items=applications.Select(a=>new CvReviewItem{BatchId=batch.Id,Name=a.FullName,Email=a.Email,Source="Application",FileName=a.Name,StorageKey=a.StorageKey}).ToList();
        items.AddRange(request.ExternalRows.Select(r=>new CvReviewItem{BatchId=batch.Id,Name=r.Name,Email=r.Email,Source="ExcelOrText",CvText=r.CvText}));
        var createdKeys=new List<string>();
        try {
            foreach(var upload in uploads){var name=Path.GetFileName(upload.FileName);if(name.Length>500)throw new ArgumentException("Tên tệp quá dài.");var key=await files.SaveAsync(upload);createdKeys.Add(key);items.Add(new CvReviewItem{BatchId=batch.Id,Name=name,Source="Upload",FileName=name,StorageKey=key});}
            db.CvReviewBatches.Add(batch);db.CvReviewItems.AddRange(items);await db.SaveChangesAsync();return batch;
        } catch {foreach(var key in createdKeys)await files.RemoveAsync(key);throw;}
    }

    public static double? MinimumYears(string experience)
    {
        if(experience.Trim().Equals("Không yêu cầu",StringComparison.OrdinalIgnoreCase))return 0;
        var match=Regex.Match(experience,@"^\s*(?:từ\s+|ít nhất\s+)?(?<years>\d+(?:[.,]\d+)?)(?:\s*[-–—]\s*\d+(?:[.,]\d+)?)?\s*năm(?:\s+kinh nghiệm)?\s*$",RegexOptions.IgnoreCase|RegexOptions.CultureInvariant);
        return match.Success&&double.TryParse(match.Groups["years"].Value.Replace(',','.'),NumberStyles.AllowDecimalPoint,CultureInfo.InvariantCulture,out var years)&&years<=100?years:null;
    }

    public async Task<CvReviewItem?> AnalyzeAsync(Guid batchId,int itemId,int companyId,CancellationToken ct)
    {
        var batch=await db.CvReviewBatches.SingleOrDefaultAsync(b=>b.Id==batchId&&b.CompanyId==companyId,ct);
        if(batch==null)return null;
        var item=await db.CvReviewItems.SingleOrDefaultAsync(i=>i.Id==itemId&&i.BatchId==batchId,ct);if(item==null)return null;
        if(item.State is "Complete" or "Incomplete")return item;
        var expiry=DateTimeOffset.UtcNow.AddMinutes(-5);
        var changed=await db.CvReviewItems.Where(i=>i.Id==itemId&&i.State!="Complete"&&i.State!="Incomplete"&&(i.State!="Running"||i.AnalyzedAt==null||i.AnalyzedAt<expiry))
            .ExecuteUpdateAsync(s=>s.SetProperty(i=>i.State,"Running").SetProperty(i=>i.AnalyzedAt,DateTimeOffset.UtcNow),ct);
        if(changed==0)throw new InvalidOperationException("Hồ sơ đang được xử lý; thử lại sau.");
        item.State="Running";item.Error="";
        try {
            var config=JsonSerializer.Deserialize<AiMatchingRequest>(batch.ConfigurationJson,Json)!;
            JsonElement result;
            if(!string.IsNullOrEmpty(item.StorageKey)){
                var bytes=await files.ReadAsync(item.StorageKey,ct)??throw new FileNotFoundException("Không tìm thấy nội dung CV trong database.");
                await using var stream=new MemoryStream(bytes);
                result=await ai.MatchFileAsync(stream,item.FileName,batch.ConfigurationJson,ct);
            }else{config.CvText=item.CvText;result=JsonSerializer.SerializeToElement(await ai.MatchAsync(config,ct),Json);}
            double? Score(JsonElement node,string name){if(!node.TryGetProperty(name,out var v)||v.ValueKind==JsonValueKind.Null)return null;if(!v.TryGetDouble(out var n)||!double.IsFinite(n)||n<0||n>100)throw new InvalidDataException("Invalid AI score");return n;}
            var status=result.TryGetProperty("status",out var state)?state.GetString():null;
            if(!result.TryGetProperty("success",out var success)||success.ValueKind!=JsonValueKind.True||result.GetProperty("model_used").GetString()!=batch.Model||status is not ("computed" or "incomplete"))throw new InvalidDataException("Invalid AI response");
            item.Score=Score(result,"overall_score");if((status=="computed")!=(item.Score!=null))throw new InvalidDataException("Contradictory AI response");
            var breakdown=result.GetProperty("breakdown");item.SemanticScore=Score(breakdown,"semantic_score");
            item.SkillScore=batch.Model=="Hybrid"?Score(breakdown,"skill_score"):null;item.ExperienceScore=batch.Model=="Hybrid"?Score(breakdown,"experience_score"):null;
            item.ResultJson=result.GetRawText();item.State=item.Score==null?"Incomplete":"Complete";
        }catch(Exception ex){logger.LogWarning(ex,"CV review failed for item {ItemId}",itemId);item.State="Error";item.ResultJson="";item.Score=null;item.SemanticScore=null;item.SkillScore=null;item.ExperienceScore=null;
            item.Error=ex is HttpRequestException?"Dịch vụ AI không sẵn sàng hoặc không đọc được CV. Có thể chạy lại.":ex is OperationCanceledException?"Yêu cầu đã dừng hoặc quá thời gian. Có thể chạy lại.":"Không phân tích được CV hoặc kết quả AI không hợp lệ. Kiểm tra tệp và thử lại.";}
        item.AnalyzedAt=DateTimeOffset.UtcNow;await db.SaveChangesAsync(CancellationToken.None);return item;
    }
}
