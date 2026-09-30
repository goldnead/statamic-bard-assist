<?php

namespace Goldnead\BardAssist\Tests\Feature;

use Goldnead\BardAssist\Tests\TestCase;
use Illuminate\Http\Request;
use PHPUnit\Framework\Attributes\Test;
use Statamic\Fieldtypes\Bard;
use Statamic\Statamic;

/**
 * Wiring: the opt-in toggle, what the browser is told, and the live preview tag.
 */
class AddonTest extends TestCase
{
    #[Test]
    public function bard_fields_get_an_opt_in_toggle(): void
    {
        $config = (new Bard)->configFields()->all();

        $this->assertTrue($config->has('bard_assist'));
        $this->assertSame('toggle', $config->get('bard_assist')->type());
        $this->assertFalse($config->get('bard_assist')->defaultValue());
    }

    #[Test]
    public function the_browser_learns_whether_a_key_exists_but_never_the_key(): void
    {
        config(['bard-assist.api_key' => 'secret-key-123456789', 'bard-assist.threshold' => 0.7]);

        $vars = Statamic::jsonVariables(request());

        $this->assertSame(['configured' => true, 'threshold' => 0.7], $vars['bardAssist']);
        $this->assertStringNotContainsString('secret-key', json_encode($vars));

        config(['bard-assist.api_key' => '']);
        $this->assertFalse(Statamic::jsonVariables(request())['bardAssist']['configured']);
    }

    #[Test]
    public function the_live_preview_tag_is_silent_on_the_public_site(): void
    {
        // tests/__fixtures__/views/layout.antlers.html holds nothing but the tag.
        $this->assertSame('<body></body>', trim(view('layout')->render()));
    }

    #[Test]
    public function the_live_preview_tag_outputs_the_morph_script_in_a_preview(): void
    {
        Request::macro('isLivePreview', fn () => true);

        $html = view('layout')->render();

        $this->assertStringContainsString('window.StatamicLivePreviewMorph', $html);
        $this->assertStringContainsString('__bardAssistPainters', $html);
    }
}
