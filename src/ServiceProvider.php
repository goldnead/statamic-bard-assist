<?php

namespace Goldnead\BardAssist;

use Statamic\Fieldtypes\Bard;
use Statamic\Providers\AddonServiceProvider;
use Statamic\Statamic;

class ServiceProvider extends AddonServiceProvider
{
    /**
     * A dependency-free, browser-native file with no imports: it extends Bard
     * through Statamic.$bard and the tiptap objects Bard hands it, so there is
     * nothing to bundle. Published to public/vendor/statamic-bard-assist/js.
     *
     * @var list<string>
     */
    protected $scripts = [
        __DIR__.'/../resources/dist/js/bard-assist.js',
    ];

    public function register()
    {
        $this->app->singleton(Jev::class);
    }

    public function bootAddon()
    {
        $this->bootFieldConfig()
            ->bootScriptData();
    }

    /**
     * Opt-in per Bard field, as a toggle in the blueprint editor.
     */
    protected function bootFieldConfig(): self
    {
        Bard::appendConfigField('bard_assist', [
            'type' => 'toggle',
            'display' => __('bard-assist::messages.config_display'),
            'instructions' => __('bard-assist::messages.config_instructions'),
            'default' => false,
        ]);

        return $this;
    }

    /**
     * Named keys only; never the key or the whole config.
     */
    protected function bootScriptData(): self
    {
        Statamic::provideToScript([
            'bardAssist' => fn () => [
                'configured' => $this->app->make(Jev::class)->configured(),
                'threshold' => (float) config('bard-assist.threshold', 0.6),
            ],
        ]);

        return $this;
    }
}
