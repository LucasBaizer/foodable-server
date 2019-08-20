function onRegister() {
	let username = $('#username').val().trim();
	let password = $('#password').val();
	let confirmPassword = $('#confirmPassword').val();
	let orgName = $('#orgName').val().trim();
	let email = $('#email').val().trim();
	let orgUrl = $('#orgUrl').val().trim();
	let about = $('#about').val().trim();

	if(password !== confirmPassword) {
		error('Passwords do not match.');
		return;
	}

	$.ajax({
		type: 'POST',
		url: 'https://foodable.app/rest/organization/register',
		dataType: 'json',
		contentType: 'application/json',
		data: JSON.stringify({
			'username': username,
			'password': password,
			'orgName': orgName,
			'email': email,
			'orgUrl': orgUrl,
			'about': about
		}),
		success: function(data) {
			window.location.href = "https://foodable.app/organizations/admin/register/success";
		},
		error: function(err) {
			if(err.status === 400) {
				error('It appears that one or more fields are invalid.');
			} else if(err.status === 500) {
				error('An error occurred. Please try again later.');
			} else {
				window.location.href = "https://foodable.app/organizations/admin/register/success";
			}
		}
	});
}

function error(msg) {
	$('body').append($('<div class="alert alert-danger alert-dismissible fade show" role="alert">' + msg + '<button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button></div>'));
}