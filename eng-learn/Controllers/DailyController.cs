using eng_learn.Models;
using eng_learn.Services;
using Microsoft.AspNetCore.Mvc;

namespace eng_learn.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DailyController(AiService aiService) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Daily([FromBody] DailyRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Chinese))
            return BadRequest(new { error = "Chinese sentence is required" });

        var result = await aiService.DailyAsync(request.Chinese);
        return Ok(result);
    }

    [HttpPost("random")]
    public async Task<IActionResult> Random([FromBody] RandomConversationRequest request)
    {
        var result = await aiService.RandomConversationAsync(request.Topic);
        return Ok(result);
    }
}
