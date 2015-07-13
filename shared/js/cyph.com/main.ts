/**
 * @file Entry point of cyph.com.
 */


/// <reference path="../preload/base.ts" />

/// <reference path="../cyph/controller.ts" />
/// <reference path="../cyph/ui/signupform.ts" />
/// <reference path="../cyph/ui/directives/signupform.ts" />
/// <reference path="ui/enums.ts" />
/// <reference path="ui/elements.ts" />
/// <reference path="ui/backgroundvideomanager.ts" />
/// <reference path="ui/dummychat.ts" />
/// <reference path="ui/cyphdemo.ts" />
/// <reference path="ui/ui.ts" />


angular.
	module('Cyph', [
		'ngMaterial',
		Cyph.UI.Directives.Chat.title,
		Cyph.UI.Directives.Markdown.title,
		Cyph.UI.Directives.SignupForm.title
	]).
	controller('CyphController', [
		'$scope',
		'$mdDialog',
		'$mdToast',
		'chatSidenav',

		($scope, $mdDialog, $mdToast, chatSidenav) => $(() => {
			Cyph.com.UI.Elements.load();

			const controller: Cyph.IController			= new Cyph.Controller($scope);
			const dialogManager: Cyph.UI.IDialogManager	= new Cyph.UI.DialogManager($mdDialog, $mdToast);
			const mobileMenu: Cyph.UI.ISidebar			= chatSidenav();

			$scope.Cyph	= Cyph;
			$scope.ui	= new Cyph.com.UI.UI(controller, dialogManager, mobileMenu);

			self['ui']	= $scope.ui;

			controller.update();
		})
	])
;


/* Redirect to Onion site when on Tor */

if (!Cyph.Env.isOnion) {
	Cyph.Util.request({
		url: Cyph.Config.onionUrl + 'ping',
		success: (data: string) => {
			if (data === 'pong') {
				locationData.href	=
					Cyph.Config.onionUrl +
					locationData.href.split(locationData.host + '/')[1]
				;
			}
		}
	});
}
