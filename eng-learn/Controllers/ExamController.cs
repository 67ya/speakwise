using eng_learn.Models;
using eng_learn.Services;
using Microsoft.AspNetCore.Mvc;

namespace eng_learn.Controllers;

[ApiController, Route("api/[controller]")]
public class ExamController(AiService ai) : ControllerBase
{
    [HttpPost("score")]
    public async Task<IActionResult> Score([FromBody] ExamScoreRequest req)
    {
        if (req.Answers == null || req.Answers.Count == 0)
            return BadRequest(new { error = "No answers provided" });

        var result = await ai.ScoreExamAsync(req);
        return Ok(result);
    }
}
