<?php

namespace IlBronza\Menu\Tests\Feature;

use IlBronza\Menu\Helpers\MenuPayloadBuilder;
use IlBronza\Menu\Tests\TestCase;
use Illuminate\Support\Facades\Route;

class MenuErrorHandlingTest extends TestCase
{
    public function test_request_options_support_the_default_and_a_custom_login_url(): void
    {
        $options = $this->payload()['options'];
        $this->assertSame(10000, $options['requestTimeoutMs']);
        $this->assertNull($options['loginUrl']);

        config(['menu.progressive.requestTimeoutMs' => 2500, 'menu.progressive.loginUrl' => '/sso/sign-in']);
        $options = $this->payload()['options'];
        $this->assertSame(2500, $options['requestTimeoutMs']);
        $this->assertSame('/sso/sign-in', $options['loginUrl']);

        config(['menu.progressive.loginUrl' => 'javascript:alert(1)']);
        $this->assertNull($this->payload()['options']['loginUrl']);
    }

    public function test_the_application_login_route_is_detected_and_can_be_overridden(): void
    {
        Route::get('/sign-in', fn () => 'Login')->name('login');
        Route::getRoutes()->refreshNameLookups();

        $this->assertSame(route('login'), $this->payload()['options']['loginUrl']);
        config(['menu.progressive.loginUrl' => 'https://identity.example.test/sign-in']);
        $this->assertSame('https://identity.example.test/sign-in', $this->payload()['options']['loginUrl']);
    }

    public function test_error_messages_follow_the_current_locale(): void
    {
        $italian = $this->payload()['messages'];
        $this->assertSame('La sessione è scaduta. Accedi di nuovo per continuare.', $italian['sessionExpired']);
        $this->assertSame('Accedi', $italian['login']);
        $this->assertSame('Il caricamento del menu sta impiegando troppo tempo.', $italian['timeout']);

        app()->setLocale('en');
        $english = $this->payload()['messages'];
        $this->assertSame('Your session has expired. Sign in again to continue.', $english['sessionExpired']);
        $this->assertSame('Sign in', $english['login']);
        $this->assertNotSame($italian['networkError'], $english['networkError']);
        $this->assertNotSame($italian['accessDenied'], $english['accessDenied']);
        $this->assertNotSame($italian['branchUnavailable'], $english['branchUnavailable']);
    }

    private function payload(): array
    {
        return (new MenuPayloadBuilder($this->menu()))->root();
    }
}
