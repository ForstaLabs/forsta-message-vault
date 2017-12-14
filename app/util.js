
function addFormErrors(formClass, errors) {
  const $f = $('form.ui.form.' + formClass);
  $f.form('add errors', errors);
  $f.find('div.error.message').addClass('visible'); // seriously, semantic?
  Object.keys(errors).forEach(key => $f.form('add prompt', key));
}

module.exports = {
  addFormErrors
};
