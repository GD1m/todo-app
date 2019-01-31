$(function () {
	'use strict';

	Handlebars.registerHelper('eq', function (a, b, options) {
		return a === b ? options.fn(this) : options.inverse(this);
	});

	const ENTER_KEY = 13;
	const ESCAPE_KEY = 27;

	const util = {
		pluralize: function (count, word) {
			return count === 1 ? word : word + 's';
		},
	};

	const App = {
		init: function () {
			axios.get('/config.json').then(function (response) {
				App.todoListTemplate = Handlebars.compile($('#todo-list-template').html());

				App.config = response.data;

				App.initAxios();

				App.router = Router(App.routes());

				const authToken = localStorage.getItem('authToken');

				if (authToken) {
					App.state.setAuthToken(authToken);

					axios.get('/users/me')
						.then(function (response) {
							App.state.setUser(response.data.user);

							App.afterUserInitialized();
						});
				} else {
					App.afterUserInitialized();
				}
			});
		},
		afterUserInitialized: function () {
			this.bindEvents();

			$('.info').show();

			this.router.init('/login');

			App.hidePreloader();

			if (!this.state.authenticated && 'register' !== this.router.getRoute(0)) {
				App.router.setRoute('/login')
			}
		},
		initAxios: function () {
			axios.defaults.baseURL = this.config.apiUrl;

			axios.interceptors.response.use(function (response) {
				return response;
			}, function (error) {
				if (401 === error.response.status) {
					App.state.setAuthToken(null);

					localStorage.removeItem('authToken');

					App.router.setRoute('/login')
				}

				if (error.response) {
					App.showError(error.response.data.error);
				}

				App.hidePreloader();

				return error;
			});
		},
		showPreloader: function () {
			$('#preloader').show();
		},
		hidePreloader: function () {
			$('#preloader').hide();
		},
		showError: function (error) {
			$('.error-message').html(error).show();

			setTimeout(function () {
				App.clearError();
			}, 2500);
		},
		clearError: function () {
			$('.error-message').hide().html('');
		},
		routes: function () {
			return {
				'/register': this.render.showRegistrationForm,
				'/login': this.render.showLoginForm,
				'/logout': Auth.logout,
				'/list': this.render.showTodoLists,
				'/todos/:uuid': this.render.showTodoList,
				'/todos/:uuid/:filter': function (uuid, filter) {
					TodoList.filter = filter;

					if (TodoList.todoList && TodoList.todoList.id === uuid) {
						TodoList.render();
					} else {
						App.render.showTodoList(uuid, filter)
					}
				}.bind(TodoList)
			}
		},
		state: {
			authenticated: false,
			authToken: null,
			user: null,
			setAuthToken: function (token) {
				App.state.authToken = token;
				App.state.authenticated = !!token;
				axios.defaults.headers.common['Authorization'] = token ? 'Bearer ' + token : null;

				localStorage.setItem('authToken', token);
			},
			setUser: function (user) {
				App.state.user = user;

				const userInfo = $('.user-info');

				userInfo.find('.username').html(user.username);

				userInfo.show();
			}
		},
		render: {
			showRegistrationForm: function () {
				if (App.state.authenticated) {
					App.router.setRoute('/list')
				}

				$('.login, .todoapp, .todos, .navigation').hide();
				$('.register').show();
			},
			showLoginForm: function () {
				if (App.state.authenticated) {
					App.router.setRoute('/list')
				}

				$('.register, .todoapp, .todos, .navigation').hide();
				$('.login').show();
			},
			showTodoLists: function () {
				if (!App.state.authenticated) {
					App.router.setRoute('/login')
				}

				$('.register, .login, .todoapp, .navigation').hide();
				$('.todos').show();

				$('.todos-list').html('');

				App.showPreloader();

				axios.get('/todos')
					.then(function (response) {
						if (response.data && response.data.todoLists) {
							response.data.todoLists.forEach(function (todoList, index) {
								$('.todos-list').append(
									App.todoLists.getTemplate(todoList)
								);
							});

							App.bindTodoListsEvent();
						}

						App.hidePreloader();
					});
			},
			showTodoList: function (uuid) {
				if (!App.state.authenticated) {
					App.router.setRoute('/login')
				}

				$('.register, .login, .todos').hide();
				$('.todoapp, .navigation').show();

				TodoList.clearTodoList();

				TodoList.render();

				App.showPreloader();

				axios
					.get('/todos/' + uuid)
					.then(function (response) {
						if (response.data && response.data.todoList) {
							TodoList.setTodoList(response.data.todoList);
						}

						TodoList.render();

						App.hidePreloader();
					});
			}
		},
		bindEvents: function () {
			$('#register_form').on('submit', Auth.register.bind(this));
			$('#login_form').on('submit', Auth.login.bind(this));
			$('#new-todos-list').on('submit', App.todoLists.addTodoList.bind(this));
		},
		bindTodoListsEvent: function () {
			$('.remove-todo-list').unbind().on('click', App.todoLists.removeTodoList.bind(this));
			$('.edit-todo-list').unbind().on('click', App.todoLists.editTodoList.bind(this));
		},
		todoLists: {
			addTodoList(e) {
				e.preventDefault();

				const formData = new FormData($('#new-todos-list')[0]);

				App.showPreloader();

				axios
					.post('/todos', formData)
					.then(function (response) {

						$('.todos-list').prepend(
							App.todoLists.getTemplate(response.data.todoList)
						);

						App.hidePreloader();
					});
			},
			removeTodoList(e) {
				e.preventDefault();

				const $element = $(e.target);
				const id = $element.parent().data('id');

				App.showPreloader();

				axios
					.delete('/todos/' + id)
					.then(function (response) {
						App.hidePreloader();

						$element.parent().remove();
					})
			},
			editTodoList(e) {
				e.preventDefault();

				const $element = $(e.target);
				const id = $element.parent().data('id');
				const title = $element.parent().data('title');

				const newTitle = prompt('Enter new title', title);

				if (!newTitle) {
					return;
				}

				App.showPreloader();

				axios
					.patch('/todos/' + id, {
						title: newTitle
					})
					.then(function (response) {
						App.hidePreloader();

						const todoList = response.data.todoList;

						$element.parent().replaceWith(App.todoLists.getTemplate(todoList));

						App.bindTodoListsEvent();
					})
			},
			getTemplate: function (todoList) {
				return App.todoListTemplate({
					id: todoList.id,
					title: todoList.title,
					createdAt: moment(todoList.createdAt).format('DD.MM.YY HH:mm'),
					updatedAt: moment(todoList.updatedAt).format('DD.MM.YY HH:mm'),
				});
			}
		}
	};

	const Auth = {
		register: function (event) {
			event.preventDefault();

			const formData = new FormData($('#register_form')[0]);

			App.showPreloader();

			axios
				.post('/users', formData)
				.then(function (response) {
					App.state.setAuthToken(response.headers.authorization);

					App.state.setUser(response.data.user);

					App.hidePreloader();

					App.router.setRoute('/list')
				});
		},
		login: function (event) {
			event.preventDefault();

			const formData = new FormData($('#login_form')[0]);

			App.showPreloader();

			axios
				.post('/users/login', formData)
				.then(function (response) {
					App.state.setAuthToken(response.headers.authorization);

					App.state.setUser(response.data.user);

					App.hidePreloader();

					App.router.setRoute('/list')
				});
		},
		logout: function () {
			App.showPreloader();

			axios
				.delete('/users/login')
				.then(function (response) {
					App.state.setAuthToken(null);

					localStorage.removeItem('authToken');

					$('.user-info').hide();

					App.hidePreloader();

					App.router.setRoute('/login')
				});
		}
	};

	const TodoList = {
		init: function () {
			this.todoTemplate = Handlebars.compile($('#todo-template').html());
			this.footerTemplate = Handlebars.compile($('#footer-template').html());
			this.bindEvents();
		},
		setTodoList: function (todoList) {
			this.todoList = todoList;
			this.todos = todoList.actions.data;
		},
		clearTodoList: function () {
			this.todoList = null;
			this.todos = [];
		},
		bindEvents: function () {
			$('.new-todo').on('keyup', this.create.bind(this));
			$('.toggle-all').on('change', this.toggleAll.bind(this));
			$('.footer').on('click', '.clear-completed', this.destroyCompleted.bind(this));
			$('.todo-list')
				.on('change', '.toggle', this.toggle.bind(this))
				.on('dblclick', 'label', this.editingMode.bind(this))
				.on('keyup', '.edit', this.editKeyup.bind(this))
				.on('focusout', '.edit', this.update.bind(this))
				.on('click', '.destroy', this.destroy.bind(this));
		},
		render: function () {
			const todos = this.getFilteredTodos();
			$('.todo-list').html(this.todoTemplate(todos));
			$('.main').toggle(todos.length > 0);
			$('.toggle-all').prop('checked', this.getActiveTodos().length === 0);
			this.renderFooter();
			$('.new-todo').focus();
		},
		renderFooter: function () {
			const todoCount = this.todos.length;
			const activeTodoCount = this.getActiveTodos().length;
			const template = this.footerTemplate({
				activeTodoCount: activeTodoCount,
				activeTodoWord: util.pluralize(activeTodoCount, 'item'),
				completedTodos: todoCount - activeTodoCount,
				filter: this.filter,
				todoList: this.todoList
			});

			$('.footer').toggle(todoCount > 0).html(template);
		},
		toggleAll: function (e) {
			const isChecked = $(e.target).prop('checked');

			App.showPreloader();

			axios
				.patch('/todos/' + this.todoList.id + '/actions', {
					'completed': isChecked ? 1 : 0,
				})
				.then(function (response) {
					TodoList.setTodoList(response.data.todoList);

					App.hidePreloader();

					TodoList.render();
				});
		},
		getActiveTodos: function () {
			return this.todos.filter(function (todo) {
				return !todo.completed;
			});
		},
		getCompletedTodos: function () {
			return this.todos.filter(function (todo) {
				return todo.completed;
			});
		},
		getFilteredTodos: function () {
			if (this.filter === 'active') {
				return this.getActiveTodos();
			}

			if (this.filter === 'completed') {
				return this.getCompletedTodos();
			}

			return this.todos;
		},
		destroyCompleted: function () {
			App.showPreloader();

			axios
				.delete('/todos/' + this.todoList.id + '/actions/completed')
				.then(function (response) {
					TodoList.setTodoList(response.data.todoList);

					App.hidePreloader();

					TodoList.render();
				});
		},
		// accepts an element from inside the `.item` div and
		// returns the corresponding index in the `todos` array
		getIndexFromEl: function (el) {
			const id = $(el).closest('li').data('id');
			const todos = this.todos;
			let i = todos.length;

			while (i--) {
				if (todos[i].id === id) {
					return i;
				}
			}
		},
		create: function (e) {
			const $input = $(e.target);
			const val = $input.val().trim();

			if (e.which !== ENTER_KEY || !val) {
				return;
			}

			App.showPreloader();

			axios
				.post('/todos/' + this.todoList.id + '/actions', {
					'title': val
				})
				.then(function (response) {
					TodoList.todos.push(response.data.action);

					$input.val('');

					App.hidePreloader();

					TodoList.render();
				});
		},
		toggle: function (e) {
			const i = this.getIndexFromEl(e.target);

			let todoAction = this.todos[i];

			App.showPreloader();

			axios
				.patch('/todos/actions/' + todoAction.id, {
					'completed': !todoAction.completed
				})
				.then(function (response) {
					TodoList.todos[i] = response.data.action;

					App.hidePreloader();

					TodoList.render();
				});
		},
		editingMode: function (e) {
			const $input = $(e.target).closest('li').addClass('editing').find('.edit');
			// puts caret at end of input
			const tmpStr = $input.val();
			$input.val('');
			$input.val(tmpStr);
			$input.focus();
		},
		editKeyup: function (e) {
			if (e.which === ENTER_KEY) {
				e.target.blur();
			}

			if (e.which === ESCAPE_KEY) {
				$(e.target).data('abort', true).blur();
			}
		},
		update: function (e) {
			const el = e.target;
			const $el = $(el);
			const val = $el.val().trim();

			if ($el.data('abort')) {
				$el.data('abort', false);
			} else if (!val) {
				this.destroy(e);
			} else {
				const i = this.getIndexFromEl(e.target);

				let todoAction = this.todos[i];

				App.showPreloader();

				axios
					.patch('/todos/actions/' + todoAction.id, {
						'title': val
					})
					.then(function (response) {
						TodoList.todos[i] = response.data.action;

						App.hidePreloader();

						TodoList.render();
					});
			}
		},
		destroy: function (e) {
			const i = this.getIndexFromEl(e.target);

			let todoAction = this.todos[i];

			App.showPreloader();

			axios
				.delete('/todos/actions/' + todoAction.id)
				.then(function (response) {
					TodoList.todos.splice(i, 1);

					App.hidePreloader();

					TodoList.render();
				});
		}
	};

	TodoList.init();

	App.init();
});
