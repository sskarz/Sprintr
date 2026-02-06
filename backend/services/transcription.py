import openai
from config import OPENAI_API_KEY

client = openai.OpenAI(api_key=OPENAI_API_KEY)


async def transcribe_audio(audio_bytes: bytes, filename: str) -> dict:
    transcript = client.audio.transcriptions.create(
        model="gpt-4o-transcribe-diarize",
        file=(filename, audio_bytes),
        response_format="diarized_json",
        chunking_strategy="auto",
        language="en",
    )

    segments = []
    for seg in transcript.segments:
        segments.append({
            "speaker": seg.speaker,
            "text": seg.text,
            "start": seg.start,
            "end": seg.end,
        })

    raw_text = "\n".join(f"Speaker {s['speaker']}: {s['text']}" for s in segments)
    return {"segments": segments, "raw_text": raw_text}


def parse_pasted_transcript(text: str) -> dict:
    return {
        "segments": [{"speaker": "unknown", "text": text, "start": 0.0, "end": 0.0}],
        "raw_text": text,
    }
