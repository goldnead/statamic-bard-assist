<?php

namespace Goldnead\BardAssist\Http\Controllers;

use Goldnead\BardAssist\Http\Controllers\Concerns\ResolvesAssistField;
use Goldnead\BardAssist\Jev;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use Statamic\Http\Controllers\CP\CpController;

/**
 * Proxies a classification request to the provider. The key stays on the server,
 * and only a publish form with an opted-in Bard field may spend it.
 */
class EvaluateController extends CpController
{
    use ResolvesAssistField;

    /** Largest block the editor asks about: one question per line, plus headroom. */
    private const MAX_QUESTIONS = 100;

    private const MAX_STATE_BYTES = 64 * 1024;

    private const MAX_QUESTIONS_BYTES = 256 * 1024;

    public function __invoke(Request $request, Jev $jev): JsonResponse
    {
        $this->assistField($request);

        $data = $request->validate([
            'state' => 'required',
            'questions' => 'required|array|max:'.self::MAX_QUESTIONS,
        ]);

        if (strlen((string) json_encode($data['state'])) > self::MAX_STATE_BYTES
            || strlen((string) json_encode($data['questions'])) > self::MAX_QUESTIONS_BYTES) {
            throw ValidationException::withMessages(['state' => __('bard-assist::messages.too_large')]);
        }

        if (! $jev->configured()) {
            return $this->fail(__('bard-assist::messages.not_configured'), 503);
        }

        try {
            $response = $jev->evaluate($data['state'], $data['questions']);
        } catch (InvalidArgumentException $e) {
            return $this->fail($e->getMessage(), 503);
        } catch (ConnectionException) {
            return $this->fail(__('bard-assist::messages.unreachable'), 504);
        }

        if (! $response->successful()) {
            report(new \RuntimeException('Bard Assist provider answered '.$response->status().': '.mb_substr($response->body(), 0, 300)));

            return $this->fail(__('bard-assist::messages.provider_error', ['status' => $response->status()]), 502);
        }

        return response()->json(['answers' => $jev->answers($response)]);
    }

    private function fail(string $message, int $status): JsonResponse
    {
        return response()->json(['message' => $message], $status);
    }
}
