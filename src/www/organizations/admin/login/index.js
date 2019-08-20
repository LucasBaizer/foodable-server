var cookie = Cookies.getJSON('accessToken');
if(cookie) {
	var date1 = new Date();
	date1.setMinutes(new Date(cookie.created).getMinutes() + cookie.expires);

	if(date1 > new Date()) {
		window.location.href = 'https://foodable.app/organizations/admin';
	}
}

$(document).ready(function() {
	$("input[class='form-control']").on("keypress", function(e) {
		if(e.which == 13) {
			onLogin();
		}
	});
});

function onLogin() {
	$.ajax({
		type: 'POST',
		url: 'https://foodable.app/rest/organization/verify',
		dataType: 'json',
		contentType: 'application/json',
		data: JSON.stringify({
			'username': $('#username').val().trim(),
			'password': $('#password').val()
		}),
		success: function(data) {
			if(data.success === true) {
				window.location.href = 'https://foodable.app/organizations/admin';
			} else {
				error('Invalid username/password.')
			}
		},
		error: function(err) {
			error('There was an error, please try again later!');
		}
	});
}

function error(msg) {
	$('body').append($('<div class="alert alert-danger alert-dismissible fade show" role="alert">' + msg + '<button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button></div>'));
}