<?php

namespace Goldnead\BardAssist\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Statamic\Contracts\Entries\Entry as EntryContract;
use Statamic\Facades\Collection;
use Statamic\Facades\Entry;
use Statamic\Facades\User;
use Statamic\Http\Controllers\CP\CpController;

/**
 * Entries a link field in a suggested set may point to, with what they are about.
 */
class TargetsController extends CpController
{
    public function __invoke(): JsonResponse
    {
        $user = User::current();
        $field = (string) config('bard-assist.targets.description_field', 'description');
        $configured = config('bard-assist.targets.collections');

        $handles = Collection::all()
            ->filter(fn ($c) => is_array($configured)
                ? in_array($c->handle(), $configured, true)
                : $c->routes()->filter()->isNotEmpty())
            ->filter(fn ($c) => $user?->can('view', $c))
            ->map->handle()
            ->values()
            ->all();

        if (! $handles) {
            return response()->json([]);
        }

        $targets = Entry::query()
            ->whereIn('collection', $handles)
            ->whereStatus('published')
            ->limit((int) config('bard-assist.targets.limit', 100))
            ->get()
            ->filter(fn (EntryContract $e) => $e->url())
            ->map(fn (EntryContract $e) => [
                'id' => $e->id(),
                'title' => (string) $e->get('title'),
                'url' => $e->url(),
                'description' => (string) ($e->get($field) ?: $e->get('title')),
            ])
            ->values();

        return response()->json($targets);
    }
}
