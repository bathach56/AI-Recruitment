using Microsoft.EntityFrameworkCore;

namespace webAI.Data;

public static class DatabaseSetup
{
    public static async Task InitializeAsync(RecruitmentDbContext db)
    {
        await db.Database.EnsureCreatedAsync();
        if (await db.Jobs.AnyAsync()) return;
        var companies = new[] {
            new Company { Name = "Nova Studio", Initials = "N", Industry = "Công nghệ & sản phẩm", Color = "blue", IsDemo = true },
            new Company { Name = "Lá Digital", Initials = "lá", Industry = "Truyền thông & sáng tạo", Color = "green", IsDemo = true },
            new Company { Name = "Orbit Labs", Initials = "O", Industry = "Công nghệ phần mềm", Color = "purple", IsDemo = true },
            new Company { Name = "Mộc Commerce", Initials = "m", Industry = "Thương mại điện tử", Color = "orange", IsDemo = true },
            new Company { Name = "Bluefin Finance", Initials = "b", Industry = "Tài chính & công nghệ", Color = "cyan", IsDemo = true },
            new Company { Name = "Sunday Creative", Initials = "su", Industry = "Thiết kế & thương hiệu", Color = "pink", IsDemo = true }
        };
        db.Companies.AddRange(companies);
        await db.SaveChangesAsync();
        var specs = new[] {
            (0, "Frontend Developer (React / TypeScript)", "Hồ Chí Minh", "Quận 3", "Công nghệ", "Hybrid", "1–3 năm", 18m, 30m, "React,TypeScript,HTML/CSS", true),
            (1, "Chuyên viên Digital Marketing", "Hồ Chí Minh", "Bình Thạnh", "Marketing", "Tại văn phòng", "1–2 năm", 12m, 20m, "SEO,Content,Google Ads", true),
            (2, "Backend Developer (.NET)", "Hà Nội", "Cầu Giấy", "Công nghệ", "Hybrid", "2–4 năm", 22m, 38m, "C#,SQL Server,ASP.NET", false),
            (3, "Nhân viên kinh doanh", "Hồ Chí Minh", "Quận 7", "Kinh doanh", "Tại văn phòng", "Không yêu cầu", 10m, 18m, "Giao tiếp,B2B,CRM", true),
            (4, "Data Analyst", "Đà Nẵng", "Hải Châu", "Dữ liệu", "Tại văn phòng", "1–3 năm", 16m, 28m, "SQL,Python,Power BI", false),
            (5, "UI/UX Designer", "Hồ Chí Minh", "Thủ Đức", "Thiết kế", "Hybrid", "1–3 năm", 16m, 26m, "Figma,UI Design,UX Research", false),
            (2, "Thực tập sinh Software Engineer", "Hà Nội", "Nam Từ Liêm", "Công nghệ", "Tại văn phòng", "Thực tập sinh", 4m, 7m, "Git,JavaScript,SQL", false),
            (1, "Content Creator", "Đà Nẵng", "Sơn Trà", "Marketing", "Từ xa", "Dưới 1 năm", 8m, 14m, "Content,Video,Social Media", false)
        };
        foreach (var (index, spec) in specs.Select((spec, index) => (index, spec)))
        {
            var (company, title, city, district, category, mode, experience, min, max, skills, urgent) = spec;
            db.Jobs.Add(new JobPosting {
                CompanyId = companies[company].Id, Title = title, City = city, District = district,
                Category = category, WorkMode = mode, Experience = experience, SalaryMin = min, SalaryMax = max,
                Skills = skills, Urgent = urgent, IsDemo = true, Vacancies = urgent ? 3 : 1,
                CreatedAt = DateTimeOffset.UtcNow.AddDays(-index), Deadline = DateTimeOffset.UtcNow.AddDays(30),
                Description = $"Đây là tin mẫu để trải nghiệm giao diện, không phải cơ hội tuyển dụng thực tế.\nTham gia đội ngũ {companies[company].Name} ở vị trí {title}.\nPhối hợp cùng các thành viên để xây dựng, triển khai và cải thiện chất lượng sản phẩm.\nChủ động đề xuất giải pháp và chia sẻ kiến thức trong nhóm.",
                Requirements = $"Có kiến thức về {skills.Replace(",", ", ")}.\nKinh nghiệm: {experience}.\nCó tinh thần học hỏi, làm việc nhóm và giao tiếp rõ ràng.",
                Benefits = "Mức lương tham khảo cho giao diện demo.\nMôi trường làm việc cởi mở, hỗ trợ phát triển chuyên môn.\nThời gian làm việc từ thứ Hai đến thứ Sáu."
            });
        }
        await db.SaveChangesAsync();
        Console.WriteLine("AIRecruitmentDb initialized. All seeded companies and jobs are explicitly marked demo.");
    }
}
