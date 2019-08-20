'use strict';

(function($, window) {
	$.fn.contextMenu = function(settings) {
		return this.each(function() {
			$(this).off('contextmenu');
			$(this).on('contextmenu', function(e) {
				if (e.ctrlKey) {
					return;
				}
				
				var $menu = $(settings.menuSelector)
					.data('invokedOn', $(e.target))
					.show()
					.css({
						position: 'absolute',
						left: getMenuPosition(e.clientX, 'width', 'scrollLeft'),
						top: getMenuPosition(e.clientY, 'height', 'scrollTop')
					})
					.off('click')
					.on('click', 'li', function (e) {
						$menu.hide();
				
						var $invokedOn = $menu.data('invokedOn');
						var $selectedMenu = $(e.target);
						
						settings.menuSelected.call(this, $invokedOn, $selectedMenu);
					});
				
				return false;
			});

			$('body').click(function() {
				$(settings.menuSelector).hide();
			});
		});
		
		function getMenuPosition(mouse, direction, scrollDir) {
			var win = $(window)[direction]();
			var	scroll = $(window)[scrollDir]();
			var	menu = $(settings.menuSelector)[direction]();
			var	position = mouse + scroll;
						
			if (mouse + menu > win && menu < mouse) {
				position -= menu;
			}
			
			return position;
		}    
	};
})(jQuery, window);

var locations = [];
var dataTable;

$(document).ready(function() {
	dataTable = $('table').DataTable();

	var cookie = Cookies.getJSON('accessToken');
	$('#OrganizationName').html(cookie.orgName);
	$('#OrganizationURL').html(cookie.orgUrl).attr('href', cookie.orgUrl);
	$('#OrganizationImage').attr('src', cookie.orgImage);

	post('/rest/locations/forOrganization', function(data) {
		locations = data;

		data.forEach(function(marker) {
			dataTable.row.add([
				marker.name,
				marker.street + ', ' + marker.city + ' ' + marker.zip,
				marker.phoneNumber,
				marker.foods,
				marker.hours,
				marker.eligibility
			]).draw(false);
		});
		setupContextMenu();
	});
});

function setupContextMenu() {
	$('tr').contextMenu({
		menuSelector: '#contextMenu',
		menuSelected: function(invokedOn, selectedMenu) {
			var row = invokedOn.parent();
			
			if(selectedMenu.html() === 'Delete') {
				dataTable.row(row).remove().draw();

				for(var locationKey in locations) {
					var location = locations[locationKey];
					if(location.name == row.children().eq(0).html()) {
						post('/rest/locations/remove', function(data) {}, location.position);
						return;
					}
				}

				setupContextMenu();
			} else if(selectedMenu.html() === 'Edit') {
				for(var locationKey in locations) {
					var location = locations[locationKey];
					if(location.name == row.children().eq(0).html()) {
						removeRow = true;
						currentRow = row;
						addLocation(location);
					}
				}

				setupContextMenu();
			}
		}
	});
}

var removeRow = false;
var currentRow = null;

function clearAdd() {
	removeRow = false;
	currentRow = null;
}

function post(endpoint, success, data) {
	var ajax = {
		type: 'POST',
		url: 'https://foodable.app' + endpoint,
		success: success,
		error: function(err) {
			if(err.status < 200 || err.status > 299) {
				console.log(err);
				error('There was an error, please try again later!');
			}
		}
	};
	if(data) {
		ajax.data = JSON.stringify(data);
		ajax.dataType = 'json';
		ajax.contentType = 'application/json';
	}
	$.ajax(ajax);
}

function submitWebsite(e) {
	if(e.keyCode == 13) {
		edit('website');
	}
}

function submitImage(e) {
	if(e.keyCode == 13) {
		edit('image');
	}
}

function edit(type) {
	if(type === 'website') {
		var c = $('#OrganizationURL');
		if(c.is('a')) {
			c.replaceWith($('<input size="' + c.html().length + '" type="text" value="' + c.html() + '" onkeyup="submitWebsite(event);" id="OrganizationURL">'));
		} else {
			c.replaceWith($('<a id="OrganizationURL" href="' + c.val().trim() + '" target="_blank">' + c.val().trim() + '</a>'));

			var cookie = Cookies.getJSON('accessToken');
			cookie.orgUrl = c.val().trim();
			Cookies.set('accessToken', JSON.stringify(cookie));
			post('/rest/organization/url', function(data) {}, {
				url: c.val().trim()
			});
		}
	} else if(type === 'image') {
		var c = $('#OrganizationImage');
		if(c.is('img')) {
			c.replaceWith($('<textarea cols="35" rows="5" type="text" onkeyup="submitImage(event);" id="OrganizationImage">' + c.attr('src') + '</textarea>'));
		} else {
			c.replaceWith($('<img src="' + c.val().trim() + '" width="256px" id="OrganizationImage">'));

			var cookie = Cookies.getJSON('accessToken');
			cookie.orgImage = c.val().trim();
			Cookies.set('accessToken', JSON.stringify(cookie));
			post('/rest/organization/image', function(data) {}, {
				url: c.val().trim()
			});
		}
	}
}

function addLocation(location) {
	$('#AddModal').modal('show');

	if(!location) {
		location = {};

		$('#LocationEligibility').val('');
		$('#LocationEligibilityUrl').val('');
	} else {
		$('#LocationEligibility').val(location.eligibility || 'none');
		$('#LocationEligibilityUrl').val(location.eligibilityUrl || 'none');
	}

	$('#LocationName').val(location.name || '');
	$('#LocationStreet').val(location.street || '');
	$('#LocationCity').val(location.city || '');
	$('#LocationZip').val(location.zip || '');
	$('#LocationUrl').val(location.url || '');
	$('#LocationFoods').val(location.foods || '');
	$('#LocationHours').val(location.hours || '');
	$('#LocationPhone').val(location.phoneNumber || '');
	$('#LocationClosures').val(location.closures || '');
}

function submitLocation() {
	var lowerEl = $('#LocationEligibility').val().toLowerCase().trim();
	var marker = {
		name: $('#LocationName').val().trim(),
		street: $('#LocationStreet').val().trim(),
		city: $('#LocationCity').val().trim(),
		zip: parseInt($('#LocationZip').val().trim()),
		url: $('#LocationUrl').val().trim(),
		foods: $('#LocationFoods').val().trim(),
		hours: $('#LocationHours').val().trim(),
		phoneNumber: $('#LocationPhone').val().trim(),
		closures: $('#LocationClosures').val().trim(),
		eligibility: $('#LocationEligibility').val().trim(),
		eligibilityUrl: (!lowerEl || lowerEl == 'none') ? null : $('#LocationEligibilityUrl').val().trim()
	};
	if(!marker.url.startsWith('http')) {
		marker.url = 'http://' + marker.url;
	}
	if(marker.eligibilityUrl && !marker.eligibilityUrl.startsWith('http')) {
		marker.eligibilityUrl = 'http://' + marker.eligibilityUrl;
	}
	if(removeRow) {
		dataTable.row(currentRow).remove().draw();

		for(var locationKey in locations) {
			var location = locations[locationKey];
			if(location.name == currentRow.children().eq(0).html()) {
				post('/rest/locations/remove', function(data) {}, location.position);
				break;
			}
		}
	}

	post('/rest/locations/add', function(data) {}, marker);

	locations.push(marker);
	dataTable.row.add([
		marker.name,
		marker.street + ', ' + marker.city + ' ' + marker.zip,
		marker.phoneNumber,
		marker.foods,
		marker.hours,
		marker.eligibility
	]).draw(false);
	setupContextMenu();
	clearAdd();

	$('#AddModal').modal('hide');
}

function openCSV() {
	$('#ImportCSV').modal('show');
}

function importCSV(e) {
	e.preventDefault();

	var data = new FormData(document.getElementById('CSVForm'));
	$.ajax({
		type: 'POST',
		url: 'https://foodable.app/rest/organization/importCSV',
		data: data,
		success: function(data) {
			window.location.reload();
		},
		error: function(err) {
			if(err.status === 400) {
				let line = err.responseJSON.line;
				if(line === 1) {
					error('The columns in your CSV appear to be wrong, make sure they match the specification!');					
				} else {
					error('Invalid CSV entry on line ' + line + '!');
				}
			} else if(err.status < 200 || err.status > 299) {
				console.log(err);
				error('There was an error, please try again later!');
			}
		},
		cache: false,
		contentType: false,
		processData: false
	});
}

function error(msg) {
	$('body').append($('<div class="alert alert-danger alert-dismissible fade show" role="alert" style="z-index: 100;">' + msg + '<button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button></div>'));
}