<?php

namespace Goldnead\BardAssist\Tests\Feature;

use Goldnead\BardAssist\Tests\TestCase;
use PHPUnit\Framework\Attributes\Test;
use Statamic\Facades\Collection;
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
    public function a_limited_user_only_sees_collections_they_may_view(): void
    {
        $this->makeCollection('news', '/news/{slug}');
        Entry::make()->collection('news')->id('n-1')->slug('hello')->data(['title' => 'Hello'])->save();

        $ids = collect($this->actingAs($this->limitedUser(['view news entries']))->getJson('/cp/bard-assist/targets')->assertOk()->json())->pluck('id')->all();

        $this->assertSame(['n-1'], $ids);
    }

    #[Test]
    public function a_description_that_is_not_text_falls_back_to_the_title(): void
    {
        Entry::find('p-1')->set('description', [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Bard']]]])->save();

        $targets = collect($this->actingAs($this->editor())->getJson('/cp/bard-assist/targets')->assertOk()->json())->keyBy('id');

        $this->assertSame('Coaching', $targets['p-1']['description']);
    }

    #[Test]
    public function the_limit_keeps_a_stable_order_by_title(): void
    {
        config(['bard-assist.targets.limit' => 1]);

        $ids = collect($this->actingAs($this->editor())->getJson('/cp/bard-assist/targets')->json())->pluck('id')->all();

        $this->assertSame(['p-1'], $ids); // "Coaching" before "Contact"
    }

    #[Test]
    public function on_a_multisite_only_the_selected_sites_entries_are_offered(): void
    {
        $this->setSites([
            'en' => ['name' => 'English', 'url' => '/', 'locale' => 'en_US'],
            'de' => ['name' => 'Deutsch', 'url' => '/de/', 'locale' => 'de_DE'],
        ]);
        $this->makeCollection('pages');
        Collection::find('pages')->sites(['en', 'de'])->save();
        // setUp's entries predate the sites; these two belong to one site each.
        Entry::make()->collection('pages')->locale('en')->id('p-en')->slug('voice')->data(['title' => 'Voice'])->save();
        Entry::make()->collection('pages')->locale('de')->id('p-1-de')->origin('p-en')->slug('stimme')->data(['title' => 'Stimme'])->save();

        $user = $this->editor();

        $en = collect($this->actingAs($user)->getJson('/cp/bard-assist/targets')->json())->pluck('id');
        $this->assertSame(['p-en'], $en->all());

        $de = collect($this->actingAs($user)->withSession(['statamic.cp.selected-site' => 'de'])->getJson('/cp/bard-assist/targets')->json())->pluck('id');
        $this->assertSame(['p-1-de'], $de->all());
    }

    #[Test]
    public function guests_get_nothing(): void
    {
        $this->getJson('/cp/bard-assist/targets')->assertUnauthorized();
    }
}
