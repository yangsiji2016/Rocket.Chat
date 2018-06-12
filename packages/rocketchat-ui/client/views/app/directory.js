import moment from 'moment';

function timeAgo(time) {
	const now = new Date();
	const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

	return (
		now.getDate() === time.getDate() && moment(time).format('LT') ||
		yesterday.getDate() === time.getDate() && t('yesterday') ||
		moment(time).format('L')
	);
}

function directorySearch(config, cb) {
	return Meteor.call('browseChannels', config, (err, result) => {
		cb(result.results && result.results.length && result.results.map(result => {
			if (config.type === 'channels') {
				return {
					name: result.name,
					users: result.usernames.length,
					createdAt: timeAgo(result.ts),
					description: result.description,
					archived: result.archived
				};
			}

			if (config.type === 'users') {
				return {
					name: result.name,
					username: result.username,
					createdAt: timeAgo(result.createdAt)
				};
			}
		}));
	});
}

Template.directory.helpers({
	searchResults() {
		return Template.instance().results.get();
	},
	searchType() {
		return Template.instance().searchType.get();
	},
	sortIcon(key) {
		const {
			sortDirection,
			searchSortBy
		} = Template.instance();

		return key === searchSortBy.get() && sortDirection.get() !== 'asc' ? 'sort-up' : 'sort-down';
	},
	createChannelOrGroup() {
		return RocketChat.authz.hasAtLeastOnePermission(['create-c', 'create-p']);
	},
	tabsData() {
		const {
			sortDirection,
			searchType,
			end,
			page
		} = Template.instance();
		return {
			tabs: [
				{
					label: t('Channels'),
					value: 'channels',
					condition() { return true; }
				},
				{
					label: t('Users'),
					value: 'users',
					condition() { return true; }
				}
			],
			onChange(value) {
				end.set(false);
				sortDirection.set('asc');
				page.set(0);
				searchType.set(value);
			}
		};
	},
	onTableItemClick() {
		const { searchType } = Template.instance();
		let type;
		let routeConfig;
		return function(item) {
			if (searchType.get() === 'channels') {
				type = 'c';
				routeConfig = {name: item.name};
			} else {
				type = 'd';
				routeConfig = {name: item.username};
			}
			FlowRouter.go(RocketChat.roomTypes.getRouteLink(type, routeConfig));
		};
	}
});

Template.directory.events({
	'input .js-search'(e, t) {
		t.end.set(false);
		t.sortDirection.set('asc');
		t.page.set(0);
		t.searchText.set(e.currentTarget.value);
	},
	'scroll .rc-directory-content'({currentTarget}, instance) {
		if (instance.loading || instance.end.get()) {
			return;
		}
		if (currentTarget.offsetHeight + currentTarget.scrollTop >= currentTarget.scrollHeight - 100) {
			return instance.page.set(instance.page.get() + 1);
		}
	},
	'click .js-sort'(e, t) {
		const el = e.currentTarget;
		const type = el.dataset.sort;

		t.end.set(false);
		t.page.set(0);

		if (t.searchSortBy.get() === type) {
			t.sortDirection.set(t.sortDirection.get() === 'asc' ? 'desc' : 'asc');
			return;
		}

		t.searchSortBy.set(type);
		t.sortDirection.set('asc');
	}
});

Template.directory.onRendered(function() {
	this.resize = () => {
		const height = this.$('.rc-directory-content').height();
		this.limit.set(Math.ceil((height / 100) + 5));
	};
	this.resize();
	$(window).on('resize', this.resize);
	Tracker.autorun(() => {
		const searchConfig = {
			text: this.searchText.get(),
			type: this.searchType.get(),
			sortBy: this.searchSortBy.get(),
			sortDirection: this.sortDirection.get(),
			limit: this.limit.get(),
			page: this.page.get()
		};
		if (this.end.get() || this.loading) {
			return;
		}
		this.loading = true;
		directorySearch(searchConfig, (result) => {
			this.loading = false;
			if (!result) {
				this.end.set(true);
			}
			if (this.page.get() > 0) {
				return this.results.set([...this.results.get(), ...result]);
			}
			return this.results.set(result);
		});
	});
});

Template.directory.onDestroyed(function() {
	$(window).on('off', this.resize);
});

Template.directory.onCreated(function() {
	this.searchText = new ReactiveVar('');
	this.searchType = new ReactiveVar('channels');
	this.searchSortBy = new ReactiveVar('name');
	this.sortDirection = new ReactiveVar('asc');
	this.limit = new ReactiveVar(0);
	this.page = new ReactiveVar(0);
	this.end = new ReactiveVar(false);

	this.results = new ReactiveVar([]);
});

Template.directory.onRendered(function() {
	$('.main-content').removeClass('rc-old');
	$('.rc-directory-content').css('height', `calc(100vh - ${ document.querySelector('.rc-directory .rc-header').offsetHeight }px)`);
});
