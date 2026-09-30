<?php

namespace Goldnead\BardAssist\Tests\Feature;

use Goldnead\BardAssist\Tests\TestCase;
use PHPUnit\Framework\Attributes\Test;
use Statamic\Facades\Entry;

/**
 * Building a suggested set (values + meta) and drawing it for the live preview.
 * Both are gated by the publish form's blueprint token, like core's set endpoint.
 */
class SetTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->makeBlueprint();
        $this->makeCollection();
    }

    private function body(string $token, array $overrides = []): array
    {
        return array_merge([
            'token' => $token,
            'reference' => null,
            'field' => 'content',
            'set' => 'step',
            'values' => ['title' => 'Knead', 'text' => 'Fold the dough.', 'unknown' => 'dropped'],
        ], $overrides);
    }

    #[Test]
    public function it_returns_preprocessed_values_and_meta(): void
    {
        $user = $this->editor();

        $response = $this->actingAs($user)
            ->postJson('/cp/bard-assist/set', $this->body($this->token($user)))
            ->assertOk()
            ->assertJsonPath('values.title', 'Knead')
            ->assertJsonPath('values.text', 'Fold the dough.')
            ->assertJsonStructure(['values' => ['title', 'text', 'button_text', 'button_link'], 'meta' => ['button_link']]);

        $this->assertArrayNotHasKey('unknown', $response->json('values'));
    }

    #[Test]
    public function the_link_meta_already_knows_its_entry(): void
    {
        $user = $this->editor();
        Entry::make()->collection('pages')->id('target-1')->slug('contact')->data(['title' => 'Contact'])->save();

        $this->actingAs($user)
            ->postJson('/cp/bard-assist/set', $this->body($this->token($user), ['values' => ['button_link' => 'entry::target-1']]))
            ->assertOk()
            ->assertJsonPath('values.button_link', 'entry::target-1')
            ->assertJsonPath('meta.button_link.initialOption', 'entry');
    }

    #[Test]
    public function an_invalid_token_is_forbidden(): void
    {
        $this->actingAs($this->editor())
            ->postJson('/cp/bard-assist/set', $this->body('not-encrypted'))
            ->assertForbidden();

        $this->actingAs($this->editor())
            ->postJson('/cp/bard-assist/render', $this->body('not-encrypted'))
            ->assertForbidden();
    }

    #[Test]
    public function another_users_token_is_forbidden(): void
    {
        $theirs = $this->token($this->editor('someone-else'));

        $this->actingAs($this->editor())
            ->postJson('/cp/bard-assist/set', $this->body($theirs))
            ->assertForbidden();

        $this->actingAs($this->editor())
            ->postJson('/cp/bard-assist/render', $this->body($theirs))
            ->assertForbidden();
    }

    #[Test]
    public function a_field_that_did_not_opt_in_is_not_served(): void
    {
        $user = $this->editor();

        $this->actingAs($user)
            ->postJson('/cp/bard-assist/set', $this->body($this->token($user), ['field' => 'plain']))
            ->assertNotFound();
    }

    #[Test]
    public function an_unknown_set_is_not_found(): void
    {
        $user = $this->editor();

        $this->actingAs($user)
            ->postJson('/cp/bard-assist/set', $this->body($this->token($user), ['set' => 'nope']))
            ->assertNotFound();
    }

    #[Test]
    public function it_renders_the_set_with_the_sites_partial(): void
    {
        $user = $this->editor();

        $html = $this->actingAs($user)
            ->post('/cp/bard-assist/render', $this->body($this->token($user)))
            ->assertOk()
            ->getContent();

        $this->assertStringContainsString('<div class="step" data-type="step">', $html);
        $this->assertStringContainsString('<h4>Knead</h4>', $html);
        $this->assertStringContainsString('<p>Fold the dough.</p>', $html);
    }

    #[Test]
    public function the_preview_escapes_what_the_editor_typed(): void
    {
        $user = $this->editor();
        $xss = '<img src=x onerror="alert(1)">';

        $html = $this->actingAs($user)
            ->post('/cp/bard-assist/render', $this->body($this->token($user), ['values' => ['title' => $xss, 'text' => 'a <b>b</b>']]))
            ->assertOk()
            ->getContent();

        $this->assertStringNotContainsString('<img', $html);
        $this->assertStringNotContainsString('<b>', $html);
        $this->assertStringContainsString('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;', $html);
    }

    #[Test]
    public function a_link_taken_from_the_text_cannot_break_out_of_its_attribute(): void
    {
        $user = $this->editor();

        $html = $this->actingAs($user)
            ->post('/cp/bard-assist/render', $this->body($this->token($user), ['values' => ['button_text' => 'Go', 'button_link' => 'https://x.test/"onmouseover="alert(1)']]))
            ->assertOk()
            ->getContent();

        $this->assertStringNotContainsString('"onmouseover="', $html);
    }

    #[Test]
    public function list_values_are_escaped_in_the_preview_too(): void
    {
        $user = $this->editor();

        $html = $this->actingAs($user)
            ->post('/cp/bard-assist/render', $this->body($this->token($user), ['set' => 'bullets', 'values' => ['items' => ['<script>x</script>', 'fine']]]))
            ->assertOk()
            ->getContent();

        $this->assertStringNotContainsString('<script>', $html);
        $this->assertStringContainsString('&lt;script&gt;x&lt;/script&gt;', $html);
    }

    #[Test]
    public function set_values_stay_raw_because_they_become_real_content(): void
    {
        $user = $this->editor();

        // Escaping here would store &lt; in the entry and double-escape it on output.
        $this->actingAs($user)
            ->postJson('/cp/bard-assist/set', $this->body($this->token($user), ['values' => ['title' => 'Fish & <Chips>']]))
            ->assertOk()
            ->assertJsonPath('values.title', 'Fish & <Chips>');
    }

    #[Test]
    public function the_partial_path_is_configurable(): void
    {
        config(['bard-assist.preview.partial' => 'blocks/{handle}']);
        $user = $this->editor();

        $this->actingAs($user)
            ->post('/cp/bard-assist/render', $this->body($this->token($user)))
            ->assertOk()
            ->assertSee('<section class="block-step">Knead</section>', false);
    }

    #[Test]
    public function without_a_partial_there_is_nothing_to_show(): void
    {
        $user = $this->editor();

        $this->actingAs($user)
            ->post('/cp/bard-assist/render', $this->body($this->token($user), ['set' => 'quote', 'values' => ['quote' => 'Hi']]))
            ->assertNoContent();
    }

    #[Test]
    public function guests_cannot_use_it(): void
    {
        $this->postJson('/cp/bard-assist/set', $this->body('x'))->assertUnauthorized();
        $this->postJson('/cp/bard-assist/render', $this->body('x'))->assertUnauthorized();
    }
}
