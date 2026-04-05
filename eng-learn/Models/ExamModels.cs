namespace eng_learn.Models;

public class ExamScoreRequest
{
    public List<ExamAnswer> Answers { get; set; } = [];
}

public class ExamAnswer
{
    public int EntryId    { get; set; }
    public string Type    { get; set; } = "english"; // "english" | "daily" | "code"
    public string Prompt  { get; set; } = "";        // what was shown to user
    public string Input   { get; set; } = "";        // user's answer
    public string Expected { get; set; } = "";       // the correct answer
    // For code type: comma-joined list of correct comment values
    public string CodeBlanks { get; set; } = "";     // "val1|||val2|||val3|||val4|||val5"
    public string CodeInputs { get; set; } = "";     // "inp1|||inp2|||inp3|||inp4|||inp5"
}

public class ExamScoreResult
{
    public int TotalScore        { get; set; }
    public List<AnswerFeedback> Feedbacks { get; set; } = [];
}

public class AnswerFeedback
{
    public int EntryId     { get; set; }
    public int Score       { get; set; }   // points for this card (max 100)
    public int Deduction   { get; set; }   // how many points deducted
    public string Comment  { get; set; } = "";
}
