$.ajax({
	type: 'POST',
	url: 'https://foodable.app/rest/organization/invalidate',
	success: function(data) {
		window.location.href = 'https://foodable.app/organizations/admin/login';
	},
	error: function(err) {
		Cookies.set('accessToken', '');
		window.location.href = 'https://foodable.app/organizations/admin/login';
	}
});