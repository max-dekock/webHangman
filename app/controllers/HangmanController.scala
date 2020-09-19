package controllers

import javax.inject._
import play.api.mvc._
import play.api.Logging
import play.api.libs.json._
import play.api.libs.json.Reads._
import play.api.libs.functional.syntax._


import scala.io.Source
import scala.util._
import hangman._
import hangman.Utils._


@Singleton
class HangmanController @Inject()(cc: ControllerComponents) extends AbstractController(cc) with Logging {
  def strToChar(s: String): Try[Char] = Try{
    require(s.length == 1)
    s.charAt(0)
  }

  implicit val wordFillWrites: Writes[WordFill] = (wf: WordFill) => Json.obj(
    "blanks" -> wf.blanks,
    "mistakes" -> wf.mistakes.map(_.toString).toSeq
  )

  implicit val wordFillReads: Reads[WordFill] = (
    (JsPath \ "blanks").read[String] and
      (JsPath \ "mistakes").read[Seq[String]].map{
        _.map(s => {
          require(s.length == 1)
          s.charAt(0)
        }).toSet
      }
  )(WordFill.apply _)

  implicit val wordFillFormat: Format[WordFill] =
    Format(wordFillReads, wordFillWrites)


  val wordList = loadWordList(Source.fromFile("wordlist_en.txt"))
  val safeList = Using(Source.fromFile("safes.txt")) { source => source.getLines().toVector }.get
  val minWordLength = safeList.map(_.length).min
  val maxWordLength = safeList.map(_.length).max

  val judge = new Judge(wordList)
  val hangman = new RiggedHangman(wordList, safeList)

  def emptyWf(wordLength: Int): WordFill =
    WordFill(Seq.fill(wordLength)('_').mkString)

  def newGame(wordLength: Int): Action[AnyContent] = Action{
    if ((minWordLength to maxWordLength).contains(wordLength)) {
      val id = Random.nextLong()
      val wf = emptyWf(wordLength)
      Ok(Json.toJson(wf))
    } else {
      BadRequest("invalid request")
    }
  }

  case class GuessRequest(state: WordFill, guess: Char)

  implicit val guessRequestWrites: Writes[GuessRequest] = (g: GuessRequest) => Json.obj(
    "state" -> g.state,
    "guess" -> g.guess.toString
  )

  implicit val guessRequestReads: Reads[GuessRequest] = (
    (JsPath \ "state").read[WordFill] and
      (JsPath \ "guess").read[String].map(s => {
        require(s.length == 1)
        s.charAt(0)
      })
  )(GuessRequest.apply _)

  import Judge._

  implicit val trialStateWrites: Writes[TrialState] =
    (
      (JsPath \ "state").write[WordFill] ~
      (JsPath \ "outcome").writeNullable[String] ~
      (JsPath \ "solution").writeNullable[String] ~
      (JsPath \ "explanation").writeNullable[String]
    ){(t: TrialState) =>
      val wf = t.wf
      val (outcome, solution, explanation) = t match {
        case Freedom(_, solution) => (Some("freedom"), Some(solution), None)
        case Death(_, solution) => (Some("death"), Some(solution), None)
        case Mistrial(_, explanation) => (Some("mistrial"), None, Some(explanation))
        case _ => (None, None, None)
      }
      (wf,outcome,solution,explanation)
    }

  def answerGuess: Action[JsValue] = Action(parse.json){ request =>
    request.body.validate[GuessRequest] match {
      case JsError(errors) =>
        errors.foreach{case(pth, es) =>
          es.foreach(e => logger.error(s"Validation error at $pth: $e"))}
        BadRequest("invalid request")
      case JsSuccess(value, path) =>
        judge.adjudicate(value.state, value.guess, hangman) match {
          case Left(err) =>
            logger.warn(s"Invalid guess: $err")
            BadRequest("invalid request")
          case Right(ts) => Ok(Json.toJson(ts))
        }
    }
  }
}
