import { useState, useRef, useCallback } from 'react';

type VoiceState = 'idle' | 'listening' | 'unsupported';

// Web Speech API 在部分浏览器下带 webkit 前缀，TypeScript 没有内建类型，用 any 桥接
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SpeechRecognitionAPI: any =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

export function useVoiceInput(onResult: (text: string) => void) {
  const [state, setState] = useState<VoiceState>(
    SpeechRecognitionAPI ? 'idle' : 'unsupported'
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recogRef = useRef<any>(null);

  const start = useCallback(() => {
    if (!SpeechRecognitionAPI) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recog: any = new SpeechRecognitionAPI();
    recog.lang = 'en-US';
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    recog.continuous = true;

    recog.onstart = () => setState('listening');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recog.onresult = (e: any) => {
      const latest = e.results[e.results.length - 1];
      if (latest.isFinal) {
        onResult(latest[0].transcript);
      }
    };

    recog.onerror = () => setState('idle');
    recog.onend   = () => setState('idle');

    recogRef.current = recog;
    recog.start();
  }, [onResult]);

  const stop = useCallback(() => {
    recogRef.current?.stop();
    setState('idle');
  }, []);

  const toggle = useCallback(() => {
    if (state === 'listening') stop();
    else start();
  }, [state, start, stop]);

  return { voiceState: state, toggle };
}
