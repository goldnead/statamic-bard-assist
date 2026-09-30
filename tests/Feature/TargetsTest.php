<?php

namespace Goldnead\BardAssist\Tests\Feature;

use Goldnead\BardAssist\Tests\TestCase;
use PHPUnit\Framework\Attributes\Test;
use Statamic\Facades\Entry;

/**
 * The entries a suggested link may point to, and what describes them to the model.
 */
class TargetsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->makeCollection('pages');
        $this->makeCollection('snippets', null);

        Entry::make()->collection('pages')->id('p-1')->slug('coaching')->data(['title' => 'Coaching', 'description' => 'One-to-one voice lessons.'])->save();
        Entry::make()->collection('pages')->id('p-2')->slug('contact')->data(['title' => 'Contact'])->save();
        Entry::make()->collection('pages')->id('p-3')->slug('draft')->published(false)->data(['title' => 'Draft'])->save();
        Entry::make()->collection('snippets')->id('s-1')->slug('footer')->data(['title' => 'Footer'])->save();
    }

    #[Test]
    public function it_lists_published_routed_entries_with_a_description(): void
    {
        $targets = collect($this->actingAs($this->editor())->getJson('/cp/bard-assist/targets')->assertOk()->json())->keyBy('id');

        $this->assertSame(['p-1', 'p-2'], $targets->keys()->sort()->values()->all());
        $this->assertSame('One-to-one voice lessons.', $targets['p-1']['description']);
        $this->assertSame('/coaching', $targets['p-1']['url']);
        // No description field: the title alone describes it.
        $this->assertSame('Contact', $targets['p-2']['description']);
    }

    #[Test]
    public function collections_and_description_field_are_configurable(): void
    {
        config(['bard-assist.targets.collections' => ['snippets'], 'bard-assist.targets.description_field' => 'summary']);

        $this->actingAs($this->editor())
            ->getJson('/cp/bard-assist/targets')
            ->assertOk()
            ->assertJsonCount(0);

        config(['bard-assist.targets.collections' => ['pages']]);

        $targets = collect($this->actingAs($this->editor())->getJson('/cp/bard-assist/targets')->json())->keyBy('id');
        $this->assertSame('Coaching', $targets['p-1']['description']);
    }

    #[Test]
    public function guests_get_nothing(): void
    {
        $this->getJson('/cp/bard-assist/targets')->assertUnauthorized();
    }
}
