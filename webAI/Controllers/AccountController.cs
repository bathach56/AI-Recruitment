using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using webAI.Services;
using webAI.Models.Entities;

namespace webAI.Controllers;

[ApiController, Route("api/account"), AutoValidateAntiforgeryToken]
public class AccountController(AccountService accounts, IAntiforgery antiforgery) : ControllerBase
{
    [HttpGet("session")]
    public IActionResult Session()
    {
        Response.Headers.CacheControl = "no-store";
        return Ok(new { authenticated = User.Identity?.IsAuthenticated == true, email = User.Identity?.Name,
            role = User.FindFirstValue(ClaimTypes.Role), token = antiforgery.GetAndStoreTokens(HttpContext).RequestToken });
    }

    [HttpPost("login"), EnableRateLimiting("account")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var user = await accounts.AuthenticateAsync(request.Email, request.Password);
        if (user == null) return Unauthorized(new { message = "Email hoặc mật khẩu không đúng." });
        await SignIn(user, request.RememberMe);
        return Ok(new { role = user.RoleName });
    }

    [HttpPost("register"), EnableRateLimiting("account")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        // Only these two public registration roles are allowed. Login roles come from SQL.
        if (request.Role is not ("Candidate" or "Recruiter")) return BadRequest(new { message = "Vai trò không hợp lệ." });
        var user = await accounts.RegisterAsync(request.Email, request.Password, request.Name, request.Role);
        if (user == null) return Conflict(new { message = "Email đã được đăng ký." });
        await SignIn(user, false);
        return Ok(new { role = user.RoleName });
    }

    [HttpPost("logout"), Authorize]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Ok();
    }

    private Task SignIn(User user, bool remember) => HttpContext.SignInAsync(
        CookieAuthenticationDefaults.AuthenticationScheme,
        new ClaimsPrincipal(new ClaimsIdentity(new[] {
            new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
            new Claim(ClaimTypes.Name, user.Email), new Claim(ClaimTypes.Role, user.RoleName)
        }, CookieAuthenticationDefaults.AuthenticationScheme)),
        new AuthenticationProperties { IsPersistent = remember, ExpiresUtc = DateTimeOffset.UtcNow.AddHours(8) });
}

public class LoginRequest
{
    [Required, EmailAddress, StringLength(150)] public string Email { get; set; } = "";
    [Required, StringLength(128, MinimumLength = 8)] public string Password { get; set; } = "";
    public bool RememberMe { get; set; }
}
public class RegisterRequest : LoginRequest
{
    [Required, StringLength(150, MinimumLength = 2)] public string Name { get; set; } = "";
    [Required] public string Role { get; set; } = "Candidate";
}
