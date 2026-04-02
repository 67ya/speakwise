using eng_learn.Models;
using eng_learn.Services;
using Microsoft.AspNetCore.Mvc;

namespace eng_learn.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AnalyzeController(AiService aiService) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Analyze([FromBody] AnalyzeRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Sentence))
            return BadRequest(new { error = "Sentence is required" });

        var result = await aiService.AnalyzeAsync(request.Sentence, request.IncludeSpoken, request.PracticeType);
        return Ok(result);
    }
}
