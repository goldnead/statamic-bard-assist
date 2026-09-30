<?php

namespace Goldnead\BardAssist\Tests\Feature;

use Goldnead\BardAssist\Tests\TestCase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\Test;

/**
 * The proxy to the classification model. The browser always speaks the direct
 * TypeSafe format; the gateway's dialect is translated on the server.
 */
class EvaluateTest extends TestCase
{
    private function payload(): array
    {
        return [
            'state' => ['paragraph' => 'Step one. Knead the dough.'],
            'questions' => [
                'set' => ['type' => 'choice', 'instructions' => 'Which block?', 'criteria' => ['Step' => 'A step', 'Plain text' => 'Prose']],
                'is_step' => ['type' => 'noul', 'instructions' => 'Is it a step?'],
            ],
        ];
    }

    #[Test]
    public function it_passes_the_direct_format_through_to_typesafe(): void
    {
        config(['bard-assist.api_key' => 'ts-key-123456789']);
        Http::fake(['api.typesafe.ai/*' => Http::response(['answers' => [
            'set' => ['type' => 'choice', 'choice' => 'Step', 'probabilities' => ['Step' => 0.9, 'Plain text' => 0.1]],
            'is_step' => ['type' => 'noul', 'noul' => 0.8],
        ]])]);

        $this->actingAs($this->editor())
            ->postJson('/cp/bard-assist/evaluate', $this->payload())
            ->assertOk()
            ->assertJsonPath('answers.set.choice', 'Step')
            ->assertJsonPath('answers.is_step.noul', 0.8);

        Http::assertSent(fn (Request $r) => $r->url() === 'https://api.typesafe.ai/v1/systemone'
            && $r->hasHeader('Authorization', 'Bearer ts-key-123456789')
            && $r['model'] === 'jev-latest'
            && $r['questions']['is_step']['type'] === 'noul'
            && $r['state']['paragraph'] === 'Step one. Knead the dough.');
    }

    #[Test]
    public function it_translates_to_and_from_the_vercel_gateway_format(): void
    {
        config(['bard-assist.provider' => 'vercel', 'bard-assist.api_key' => 'vck-key-123456789']);
        Http::fake(['ai-gateway.vercel.sh/*' => Http::response(['answers' => [
            'set' => ['type' => 'choice', 'choice' => 'Step', 'probabilities' => ['Step' => 0.9, 'Plain text' => 0.1]],
            'is_step' => ['type' => 'boolean', 'probability' => 0.7],
        ]])]);

        $this->actingAs($this->editor())
            ->postJson('/cp/bard-assist/evaluate', $this->payload())
            ->assertOk()
            ->assertJsonPath('answers.set.choice', 'Step')
            ->assertJsonPath('answers.is_step.type', 'noul')
            ->assertJsonPath('answers.is_step.noul', 0.7);

        Http::assertSent(fn (Request $r) => $r->url() === 'https://ai-gateway.vercel.sh/v1/evaluate'
            && $r['model'] === 'typesafe-ai/jev'
            && $r['questions']['is_step']['type'] === 'boolean'
            && $r['questions']['set']['type'] === 'choice');
    }

    #[Test]
    public function endpoint_and_model_can_be_overridden(): void
    {
        config(['bard-assist.api_key' => 'ts-key-123456789', 'bard-assist.endpoint' => 'https://proxy.test/jev', 'bard-assist.model' => 'jev-pinned']);
        Http::fake(['proxy.test/*' => Http::response(['answers' => []])]);

        $this->actingAs($this->editor())->postJson('/cp/bard-assist/evaluate', $this->payload())->assertOk();

        Http::assertSent(fn (Request $r) => $r->url() === 'https://proxy.test/jev' && $r['model'] === 'jev-pinned');
    }

    #[Test]
    public function without_a_key_it_says_so_and_calls_nobody(): void
    {
        config(['bard-assist.api_key' => null]);
        Http::fake();

        $this->actingAs($this->editor())
            ->postJson('/cp/bard-assist/evaluate', $this->payload())
            ->assertStatus(503)
            ->assertJsonPath('message', __('bard-assist::messages.not_configured'));

        Http::assertNothingSent();
    }

    #[Test]
    public function a_provider_error_becomes_a_502_without_leaking_the_body(): void
    {
        config(['bard-assist.api_key' => 'ts-key-123456789']);
        Http::fake(['api.typesafe.ai/*' => Http::response(['error' => 'internal detail'], 500)]);

        $this->actingAs($this->editor())
            ->postJson('/cp/bard-assist/evaluate', $this->payload())
            ->assertStatus(502)
            ->assertJsonMissing(['error' => 'internal detail']);
    }

    #[Test]
    public function an_unknown_provider_is_reported_not_guessed(): void
    {
        config(['bard-assist.provider' => 'openai', 'bard-assist.api_key' => 'ts-key-123456789']);
        Http::fake();

        $this->actingAs($this->editor())
            ->postJson('/cp/bard-assist/evaluate', $this->payload())
            ->assertStatus(503);

        Http::assertNothingSent();
    }

    #[Test]
    public function it_validates_the_request(): void
    {
        config(['bard-assist.api_key' => 'ts-key-123456789']);

        $this->actingAs($this->editor())
            ->postJson('/cp/bard-assist/evaluate', ['state' => 'x'])
            ->assertStatus(422);
    }

    #[Test]
    public function guests_cannot_use_it(): void
    {
        config(['bard-assist.api_key' => 'ts-key-123456789']);
        Http::fake();

        $this->postJson('/cp/bard-assist/evaluate', $this->payload())->assertUnauthorized();

        Http::assertNothingSent();
    }
}
