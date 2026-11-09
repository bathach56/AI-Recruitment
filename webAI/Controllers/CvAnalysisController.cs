using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace webAI.Controllers;

// Explicit retirement responses for old clients instead of fabricated scores.
[Authorize(Roles = "Candidate"), ApiController, Route("api/cv")]
public class CvAnalysisController : ControllerBase
{
    [HttpPost("upload")]
    public IActionResult Upload() => StatusCode(410, new { message = "API chấm CV minh họa đã ngừng. Tải CV tại Hồ sơ & CV; đối chiếu AI được thực hiện theo JD trong không gian tuyển dụng." });

    [HttpGet("result/{id}")]
    public IActionResult GetResult(string id) => StatusCode(410, new { message = "Kết quả minh họa không còn được cung cấp. Xem trạng thái hồ sơ trong Việc đã ứng tuyển." });
}
