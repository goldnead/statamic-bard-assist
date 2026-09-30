<?php

namespace Goldnead\BardAssist;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use InvalidArgumentException;

/**
 * TypeSafe's Jev, called directly or through the Vercel AI Gateway.
 *
 * Callers always speak the direct format (question type "noul", answer field
 * "noul"). The gateway calls the same thing "boolean" / "probability", so
 * questions and answers are translated on the way through.
 */
class Jev
{
    public const PROVIDERS = [
        'typesafe' => ['endpoint' => 'https://api.typesafe.ai/v1/systemone', 'model' => 'jev-latest'],
        'vercel' => ['endpoint' => 'https://ai-gateway.vercel.sh/v1/evaluate', 'model' => 'typesafe-ai/jev'],
    ];

    public function configured(): bool
    {
        return $this->key() !== '';
    }

    public function provider(): string
    {
        $provider = (string) config('bard-assist.provider', 'typesafe');

        if (! isset(self::PROVIDERS[$provider])) {
            throw new InvalidArgumentException("Unknown Bard Assist provider [{$provider}]. Use \"typesafe\" or \"vercel\".");
        }

        return $provider;
    }

    /**
     * @param  array<string, array<string, mixed>>  $questions
     */
    public function evaluate(mixed $state, array $questions): Response
    {
        $provider = $this->provider();
        $defaults = self::PROVIDERS[$provider];
        $gateway = $provider === 'vercel';

        return Http::withToken($this->key())
            ->acceptJson()
            ->timeout((int) config('bard-assist.timeout', 6))
            ->post(config('bard-assist.endpoint') ?: $defaults['endpoint'], [
                'model' => config('bard-assist.model') ?: $defaults['model'],
                'state' => $state,
                'questions' => $gateway ? $this->toGateway($questions) : $questions,
            ]);
    }

    /**
     * Answers in the direct format, whichever provider produced them.
     *
     * @return array<string, mixed>
     */
    public function answers(Response $response): array
    {
        $answers = (array) $response->json('answers', []);

        if ($this->provider() !== 'vercel') {
            return $answers;
        }

        return array_map(fn ($a) => is_array($a) && ($a['type'] ?? null) === 'boolean'
            ? ['type' => 'noul', 'noul' => $a['probability'] ?? null]
            : $a, $answers);
    }

    /**
     * @param  array<string, array<string, mixed>>  $questions
     * @return array<string, array<string, mixed>>
     */
    private function toGateway(array $questions): array
    {
        return array_map(fn ($q) => is_array($q) && ($q['type'] ?? null) === 'noul'
            ? ['type' => 'boolean'] + $q
            : $q, $questions);
    }

    private function key(): string
    {
        return trim((string) config('bard-assist.api_key', ''));
    }
}
