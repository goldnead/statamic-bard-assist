<?php

namespace Goldnead\BardAssist\Tests\Feature;

use Goldnead\BardAssist\Tests\TestCase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\Test;
use Statamic\Contracts\Auth\User;

/**
 * The proxy to the classification model. The browser always speaks the direct
 * TypeSafe format; the gateway's dialect is translated on the server. Only a
 * publish form with an opted-in Bard field may spend the key.
 */
class EvaluateTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->makeBlueprint();
        config(['bard-assist.api_key' => 'ts-key-123456789']);
    }

    private function payload(User $user, array $overrides = []): array
    {
        return array_merge([
            'token' => $this->token($user),
            'field' => 'content',
            'state' => ['paragraph' => 'Step one. Knead the dough.'],
            'questions' => [
                'set' => ['type' => 'choice', 'instructions' => 'Which block?', 'criteria' => ['Step' => 'A step', 'Plain text' => 'Prose']],
                'is_step' => ['type' => 'noul', 'instructions' => 'Is it a step?'],
            ],
        ], $overrides);
    }

    #[Test]
    public function it_passes_the_direct_format_through_to_typesafe(): void
    {
        Http::fake(['api.typesafe.ai/*' => Http::response(['answers' => [
            'set' => ['type' => 'choice', 'choice' => 'Step', 'probabilities' => ['Step' => 0.9, 'Plain text' => 0.1]],
            'is_step' => ['type' => 'noul', 'noul' => 0.8],
        ]])]);
        $user = $this->editor();

        $this->actingAs($user)
            ->postJson('/cp/bard-assist/evaluate', $this->payload($user))
            ->assertOk()
            ->assertJsonPath('answers.set.choice', 'Step')
            ->assertJsonPath('answers.is_step.noul', 0.8);

        Http::assertSent(fn (Request $r) => $r->url() === 'https://api.typesafe.ai/v1/systemone'
            && $r->hasHeader('Authorization', 'Bearer ts-key-123456789')
            && $r['model'] === 'jev-latest'
            && $r['questions']['is_step']['type'] === 'noul'
            && $r['state']['paragraph'] === 'Step one. Knead the dough.'
            // Only state and questions travel; the token stays here.
            && ! isset($r['token']));
    }

    #[Test]
    public function it_translates_to_and_from_the_vercel_gateway_format(): void
    {
        config(['bard-assist.provider' => 'vercel', 'bard-assist.api_key' => 'vck-key-123456789']);
        Http::fake(['ai-gateway.vercel.sh/*' => Http::response(['answers' => [
            'set' => ['type' => 'choice', 'choice' => 'Step', 'probabilities' => ['Step' => 0.9, 'Plain text' => 0.1]],
            'is_step' => ['type' => 'boolean', 'probability' => 0.7],
        ]])]);
        $user = $this->editor();

        $this->actingAs($user)
            ->postJson('/cp/bard-assist/evaluate', $this->payload($user))
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
        config(['bard-assist.endpoint' => 'https://proxy.test/jev', 'bard-assist.model' => 'jev-pinned']);
        Http::fake(['proxy.test/*' => Http::response(['answers' => []])]);
        $user = $this->editor();

        $this->actingAs($user)->postJson('/cp/bard-assist/evaluate', $this->payload($user))->assertOk();

        Http::assertSent(fn (Request $r) => $r->url() === 'https://proxy.test/jev' && $r['model'] === 'jev-pinned');
    }

    #[Test]
    public function a_user_who_is_not_a_super_user_can_use_it_from_their_publish_form(): void
    {
        Http::fake(['api.typesafe.ai/*' => Http::response(['answers' => []])]);
        $user = $this->limitedUser(['view pages entries', 'edit pages entries']);

        $this->actingAs($user)->postJson('/cp/bard-assist/evaluate', $this->payload($user))->assertOk();
    }

    #[Test]
    public function without_a_token_it_is_forbidden_and_calls_nobody(): void
    {
        Http::fake();
        $user = $this->editor();

        $this->actingAs($user)
            ->postJson('/cp/bard-assist/evaluate', $this->payload($user, ['token' => null]))
            ->assertForbidden();

        $this->actingAs($user)
            ->postJson('/cp/bard-assist/evaluate', $this->payload($user, ['token' => 'tampered']))
            ->assertForbidden();

        $this->actingAs($user)
            ->postJson('/cp/bard-assist/evaluate', $this->payload($user, ['token' => $this->token($this->editor('someone-else'))]))
            ->assertForbidden();

        Http::assertNothingSent();
    }

    #[Test]
    public function a_field_that_did_not_opt_in_cannot_spend_the_key(): void
    {
        Http::fake();
        $user = $this->editor();

        $this->actingAs($user)
            ->postJson('/cp/bard-assist/evaluate', $this->payload($user, ['field' => 'plain']))
            ->assertNotFound();

        $this->actingAs($user)
            ->postJson('/cp/bard-assist/evaluate', $this->payload($user, ['field' => 'title']))
            ->assertNotFound();

        Http::assertNothingSent();
    }

    #[Test]
    public function oversized_requests_are_refused(): void
    {
        Http::fake();
        $user = $this->editor();
        $many = array_fill_keys(array_map(fn ($i) => "q{$i}", range(1, 101)), ['type' => 'noul', 'instructions' => 'x']);

        $this->actingAs($user)
            ->postJson('/cp/bard-assist/evaluate', $this->payload($user, ['questions' => $many]))
            ->assertStatus(422);

        $this->actingAs($user)
            ->postJson('/cp/bard-assist/evaluate', $this->payload($user, ['state' => ['paragraph' => str_repeat('a', 70 * 1024)]]))
            ->assertStatus(422);

        Http::assertNothingSent();
    }

    #[Test]
    public function the_rate_limit_is_configurable(): void
    {
        config(['bard-assist.rate_limit' => 2]);
        Http::fake(['api.typesafe.ai/*' => Http::response(['answers' => []])]);
        $user = $this->editor();

        $this->actingAs($user)->postJson('/cp/bard-assist/evaluate', $this->payload($user))->assertOk();
        $this->actingAs($user)->postJson('/cp/bard-assist/evaluate', $this->payload($user))->assertOk();
        $this->actingAs($user)
            ->postJson('/cp/bard-assist/evaluate', $this->payload($user))
            ->assertStatus(429)
            ->assertJsonPath('message', __('bard-assist::messages.rate_limited'));
    }

    #[Test]
    public function without_a_key_it_says_so_and_calls_nobody(): void
    {
        config(['bard-assist.api_key' => null]);
        Http::fake();
        $user = $this->editor();

        $this->actingAs($user)
            ->postJson('/cp/bard-assist/evaluate', $this->payload($user))
            ->assertStatus(503)
            ->assertJsonPath('message', __('bard-assist::messages.not_configured'));

        Http::assertNothingSent();
    }

    #[Test]
    public function a_provider_error_becomes_a_502_without_leaking_the_body(): void
    {
        Http::fake(['api.typesafe.ai/*' => Http::response(['error' => 'internal detail'], 500)]);
        $user = $this->editor();

        $this->actingAs($user)
            ->postJson('/cp/bard-assist/evaluate', $this->payload($user))
            ->assertStatus(502)
            ->assertJsonMissing(['error' => 'internal detail']);
    }

    #[Test]
    public function an_unknown_provider_is_reported_not_guessed(): void
    {
        config(['bard-assist.provider' => 'openai']);
        Http::fake();
        $user = $this->editor();

        $this->actingAs($user)
            ->postJson('/cp/bard-assist/evaluate', $this->payload($user))
            ->assertStatus(503);

        Http::assertNothingSent();
    }

    #[Test]
    public function it_validates_the_request(): void
    {
        $user = $this->editor();

        $this->actingAs($user)
            ->postJson('/cp/bard-assist/evaluate', $this->payload($user, ['questions' => null]))
            ->assertStatus(422);
    }

    #[Test]
    public function guests_cannot_use_it(): void
    {
        Http::fake();

        $this->postJson('/cp/bard-assist/evaluate', ['state' => 'x', 'questions' => ['a' => []]])->assertUnauthorized();

        Http::assertNothingSent();
    }
}
