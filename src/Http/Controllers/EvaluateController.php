<?php

namespace Goldnead\BardAssist\Http\Controllers;

use Goldnead\BardAssist\Jev;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;
use Statamic\Http\Controllers\CP\CpController;

/**
 * Proxies a classification request to the provider. The key stays on the server.
 */
class EvaluateController extends CpController
{
    public function __invoke(Request $request, Jev $jev): JsonResponse
    {
        $data = $request->validate([
            'state' => 'required',
            'questions' => 'required|array',
        ]);

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
