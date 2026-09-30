<?php

namespace Goldnead\BardAssist\Tests;

use Goldnead\BardAssist\ServiceProvider;
use Statamic\Contracts\Auth\User as UserContract;
use Statamic\Facades\Blueprint;
use Statamic\Facades\Collection;
use Statamic\Facades\Role;
use Statamic\Facades\Site;
use Statamic\Facades\User;
use Statamic\Fields\Blueprint as BlueprintInstance;
use Statamic\Testing\AddonTestCase;
use Statamic\Testing\Concerns\PreventsSavingStacheItemsToDisk;

abstract class TestCase extends AddonTestCase
{
    use PreventsSavingStacheItemsToDisk;

    protected string $addonServiceProvider = ServiceProvider::class;

    protected const FQH = 'collections.pages.page';

    protected function defineEnvironment($app): void
    {
        parent::defineEnvironment($app);

        $app['config']->set('statamic.system.multisite', false);
        // Two users in one test (the "someone else's token" case) need Pro.
        $app['config']->set('statamic.editions.pro', true);
        $app['config']->set('view.paths', [__DIR__.'/__fixtures__/views']);
        // Roles and groups into the directory the suite wipes after every test.
        $app['config']->set('statamic.users.repositories.file.paths.roles', __DIR__.'/__fixtures__/dev-null/roles.yaml');
        $app['config']->set('statamic.users.repositories.file.paths.groups', __DIR__.'/__fixtures__/dev-null/groups.yaml');
    }

    /**
     * A page blueprint with one opted-in Bard field, one that did not opt in,
     * and a set whose last two fields are a label and its link.
     *
     * Faked onto the repository rather than saved, so no run leaves a file behind.
     */
    protected function makeBlueprint(): BlueprintInstance
    {
        $sets = [
            'main' => [
                'display' => 'Main',
                'sets' => [
                    'step' => [
                        'display' => 'Step',
                        'instructions' => 'One step in a process.',
                        'fields' => [
                            ['handle' => 'title', 'field' => ['type' => 'text']],
                            ['handle' => 'text', 'field' => ['type' => 'textarea']],
                            ['handle' => 'button_text', 'field' => ['type' => 'text']],
                            ['handle' => 'button_link', 'field' => ['type' => 'link', 'collections' => ['pages']]],
                        ],
                    ],
                    'bullets' => [
                        'display' => 'Bullets',
                        'fields' => [
                            ['handle' => 'items', 'field' => ['type' => 'list']],
                        ],
                    ],
                    'quote' => [
                        'display' => 'Quote',
                        'fields' => [
                            ['handle' => 'quote', 'field' => ['type' => 'textarea']],
                        ],
                    ],
                ],
            ],
        ];

        $blueprint = Blueprint::makeFromFields([
            'title' => ['type' => 'text'],
            'content' => ['type' => 'bard', 'bard_assist' => true, 'sets' => $sets],
            'plain' => ['type' => 'bard', 'sets' => $sets],
        ])->setHandle('page')->setNamespace('collections.pages');

        Blueprint::shouldReceive('find')->with(self::FQH)->andReturn($blueprint);
        Blueprint::shouldReceive('in')->with('collections/pages')->andReturn(collect(['page' => $blueprint]));
        Blueprint::makePartial();

        return $blueprint;
    }

    protected function makeCollection(string $handle = 'pages', ?string $route = '/{slug}'): void
    {
        $collection = Collection::make($handle);

        if ($route) {
            $collection->routes($route);
        }

        $collection->save();
    }

    /**
     * @param  array<string, array<string, string>>  $sites
     */
    protected function setSites(array $sites): void
    {
        config(['statamic.system.multisite' => true]);
        Site::setSites($sites);
    }

    protected function editor(string $id = 'editor-1'): UserContract
    {
        return tap(User::make()->id($id)->email($id.'@example.com')->makeSuper())->save();
    }

    /**
     * A CP user who is not a super user, with exactly these permissions.
     *
     * @param  list<string>  $permissions
     */
    protected function limitedUser(array $permissions, string $id = 'limited-1'): UserContract
    {
        $role = Role::make('limited')->title('Limited')->permissions(['access cp', ...$permissions]);
        $role->save();

        return tap(User::make()->id($id)->email($id.'@example.com')->assignRole($role))->save();
    }

    protected function token(UserContract $user, string $fqh = self::FQH): string
    {
        return encrypt(['fqh' => $fqh, 'user_id' => $user->id()]);
    }
}
