function renderBookmarksPage(req, res) {
  res.render('bookmarks/index', {
    pageTitle: 'Danh Sách Đã Lưu',
    currentPath: req.path
  });
}

module.exports = {
  renderBookmarksPage
};
