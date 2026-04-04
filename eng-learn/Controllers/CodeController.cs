using eng_learn.Services;
using Microsoft.AspNetCore.Mvc;

namespace eng_learn.Controllers;

[ApiController, Route("api/[controller]")]
public class CodeController(AiService ai) : ControllerBase
{
    public record CodeRequest(string Code);

    [HttpPost]
    public async Task<IActionResult> Analyze([FromBody] CodeRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Code))
            return BadRequest(new { error = "Code is required" });
        return Ok(await ai.CodeAsync(req.Code));
    }
}
