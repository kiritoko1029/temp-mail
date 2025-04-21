document.addEventListener('DOMContentLoaded', () => {
  // 初始化 dayjs
  dayjs.locale('zh-cn');
  
  // 缓存DOM元素
  const mailListEl = document.getElementById('mailList');
  const mailDetailEl = document.getElementById('mailDetail');
  const mailCountEl = document.getElementById('mailCount');
  const currentEmailEl = document.getElementById('currentEmail');
  const refreshBtn = document.getElementById('refreshBtn');
  const htmlModal = document.getElementById('htmlModal');
  const htmlPreview = document.getElementById('htmlPreview');
  const closeHtmlModal = document.getElementById('closeHtmlModal');
  const viewModeSelect = document.getElementById('viewModeSelect');
  const autoRefreshStatus = document.getElementById('autoRefreshStatus');
  
  // 验证相关元素
  const authScreen = document.getElementById('authScreen');
  const authForm = document.getElementById('authForm');
  const accessCodeInput = document.getElementById('accessCode');
  const authBtnText = document.getElementById('authBtnText');
  const authLoading = document.getElementById('authLoading');
  const authError = document.getElementById('authError');
  
  // 保存当前选中的邮件ID、配置和当前邮件数据
  let selectedMailId = null;
  let appConfig = {
    requireAuth: true,
    apiUrl: ''
  };
  let currentMailData = null;
  let currentViewMode = 'auto'; // 'text', 'html', 'auto'
  let isAuthenticated = false;
  let autoRefreshInterval = null;
  
  // 初始化认证状态
  function initAuth() {
    // 检查本地存储中的认证状态
    const authToken = localStorage.getItem('authToken');
    const authExpiry = localStorage.getItem('authExpiry');
    
    if (authToken && authExpiry && new Date().getTime() < parseInt(authExpiry)) {
      // 如果有有效的认证令牌，直接进入应用
      isAuthenticated = true;
      authScreen.classList.add('hidden');
      initApp();
    } else {
      // 清除过期的令牌
      localStorage.removeItem('authToken');
      localStorage.removeItem('authExpiry');
      
      // 显示认证界面
      authScreen.classList.remove('hidden');
      accessCodeInput.focus();
    }
  }
  
  // 处理认证表单提交
  function handleAuthSubmit(e) {
    e.preventDefault();
    
    const code = accessCodeInput.value.trim();
    if (!code) {
      showAuthError('请输入访问码');
      return;
    }
    
    // 显示加载状态
    authBtnText.classList.add('hidden');
    authLoading.classList.remove('hidden');
    authError.classList.add('hidden');
    
    // 发送验证请求
    fetch('/api/verify-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // 验证成功，保存认证状态
        isAuthenticated = true;
        
        // 生成简单的令牌并保存到本地存储（24小时有效）
        const token = Date.now().toString(36) + Math.random().toString(36).substring(2);
        const expiry = new Date().getTime() + (24 * 60 * 60 * 1000); // 24小时后过期
        
        localStorage.setItem('authToken', token);
        localStorage.setItem('authExpiry', expiry);
        
        // 隐藏认证界面，初始化应用
        authScreen.classList.add('hidden');
        initApp();
      } else {
        // 验证失败，显示错误信息
        showAuthError(data.message || '验证码错误');
        
        // 添加抖动效果
        authForm.classList.add('shake');
        setTimeout(() => {
          authForm.classList.remove('shake');
        }, 500);
      }
    })
    .catch(error => {
      showAuthError('验证请求失败，请重试');
      console.error('验证错误:', error);
    })
    .finally(() => {
      // 恢复按钮状态
      authBtnText.classList.remove('hidden');
      authLoading.classList.add('hidden');
    });
  }
  
  // 显示认证错误
  function showAuthError(message) {
    authError.textContent = message;
    authError.classList.remove('hidden');
  }
  
  // 初始化应用
  function initApp() {
    // 加载配置和用户偏好
    loadUserPreferences();
    
    // 绑定事件
    initEventListeners();
    
    // 加载数据
    loadConfig().then(() => {
      loadMailList();
      
      // 启动自动刷新
      startAutoRefresh();
    });
  }
  
  // 获取服务器配置
  async function loadConfig() {
    try {
      const response = await fetch('/api/config');
      appConfig = await response.json();
      currentEmailEl.textContent = `当前邮箱: ${appConfig.email}`;
    } catch (error) {
      console.error('加载配置失败:', error);
      currentEmailEl.textContent = '未能获取邮箱配置';
    }
  }
  
  // 启动自动刷新
  function startAutoRefresh() {
    // 清除现有的定时器
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
    }
    
    // 每5秒刷新一次
    autoRefreshInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadMailList();
        autoRefreshStatus.innerHTML = '自动刷新: <span class="text-success">活跃</span>';
      } else {
        autoRefreshStatus.innerHTML = '自动刷新: <span class="text-gray">暂停</span>';
      }
    }, 5000);
  }
  
  // 加载邮件列表
  async function loadMailList() {
    try {
      // 只有在第一次加载时显示加载动画，避免频繁刷新时闪烁
      if (!mailListEl.innerHTML || mailListEl.innerHTML.includes('没有邮件')) {
        mailListEl.innerHTML = '<div class="p-4 text-center"><div class="loading mx-auto"></div><p class="mt-4 text-gray">加载邮件列表中...</p></div>';
      }
      
      const response = await fetch('/api/mails');
      const data = await response.json();
      
      if (!data.result) {
        throw new Error('获取邮件失败');
      }
      
      // 更新邮箱地址(如果API返回了)和邮件数量
      if (data.mail_list.length > 0 && data.mail_list[0].to) {
        currentEmailEl.textContent = `当前邮箱: ${data.mail_list[0].to}`;
      }
      mailCountEl.textContent = `共 ${data.count} 封邮件`;
      
      // 清空列表
      mailListEl.innerHTML = '';
      
      if (data.mail_list.length === 0) {
        mailListEl.innerHTML = '<div class="p-4 text-center text-gray">没有邮件</div>';
        return;
      }
      
      // 渲染邮件列表
      data.mail_list.forEach(mail => {
        const mailItem = document.createElement('div');
        mailItem.className = 'mail-item';
        mailItem.dataset.id = mail.mail_id;
        
        const isNewBadge = mail.is_new 
          ? '<span class="mail-new-badge"></span>' 
          : '';
          
        mailItem.innerHTML = `
          <div class="mail-item-header">
            <h3 class="mail-item-subject">${isNewBadge}${mail.subject || '(无主题)'}</h3>
            <span class="mail-item-time">${formatDate(mail.time)}</span>
          </div>
          <div class="mail-item-sender">${mail.from_name || mail.from_mail}</div>
        `;
        
        mailItem.addEventListener('click', () => loadMailDetail(mail.mail_id));
        mailListEl.appendChild(mailItem);
      });
      
      // 如果之前有选中的邮件，保持其选中状态
      if (selectedMailId) {
        document.querySelectorAll('.mail-item').forEach(item => {
          item.classList.toggle('active', item.dataset.id == selectedMailId);
        });
      }
      
    } catch (error) {
      console.error('加载邮件列表失败:', error);
      mailListEl.innerHTML = `<div class="p-4 text-center text-danger">加载失败: ${error.message}</div>`;
    }
  }
  
  // 加载邮件详情
  async function loadMailDetail(mailId) {
    try {
      // 更新选中状态
      selectedMailId = mailId;
      document.querySelectorAll('.mail-item').forEach(item => {
        item.classList.toggle('active', item.dataset.id == mailId);
      });
      
      // 显示加载状态
      mailDetailEl.innerHTML = '<div class="p-6 text-center"><div class="loading mx-auto"></div><p class="mt-4 text-gray">加载邮件内容中...</p></div>';
      
      const response = await fetch(`/api/mails/${mailId}`);
      const data = await response.json();
      
      if (!data.result) {
        throw new Error('获取邮件详情失败');
      }
      
      // 保存当前邮件数据用于HTML预览
      currentMailData = data;
      
      // 检查是否有HTML内容
      const hasHtml = !!data.html;
      const hasText = !!data.text;
      
      // 确定最佳显示模式
      let bestViewMode = 'text'; // 默认显示纯文本
      if (currentViewMode === 'auto') {
        bestViewMode = hasHtml ? 'html' : 'text';
      } else {
        bestViewMode = currentViewMode;
        // 如果选择了html但没有html内容，或选择了text但没有text内容，则切换到可用的模式
        if ((bestViewMode === 'html' && !hasHtml) || (bestViewMode === 'text' && !hasText)) {
          bestViewMode = hasHtml ? 'html' : 'text';
        }
      }
      
      // 渲染邮件详情
      mailDetailEl.innerHTML = `
        <div class="mail-detail-header">
          <h2 class="mail-subject">${data.subject || '(无主题)'}</h2>
          
          <div class="mail-meta">
            <div class="mail-meta-item">
              <span>发件人:</span>
              <span>${data.from_name ? `${data.from_name} &lt;${data.from_mail}&gt;` : data.from_mail}</span>
            </div>
            <div class="mail-meta-item">
              <span>收件人:</span>
              <span>${data.to || '(隐藏)'}</span>
            </div>
            <div class="mail-meta-item">
              <span>日期:</span>
              <span>${formatFullDate(data.date)}</span>
            </div>
            <div class="mail-meta-item">
              <span>安全连接:</span>
              <span>${data.is_tls ? '<span class="text-success">是</span>' : '<span class="text-danger">否</span>'}</span>
            </div>
          </div>
          
          ${hasHtml && hasText ? `
          <div class="mt-4 btn-group">
            <button id="viewTextBtn" class="btn${bestViewMode === 'text' ? '' : ' btn-secondary'}">
              纯文本
            </button>
            <button id="viewHtmlBtn" class="btn${bestViewMode === 'html' ? '' : ' btn-secondary'}">
              HTML
            </button>
          </div>
          ` : ''}
        </div>

        <div id="textContent" class="mail-content ${bestViewMode === 'html' ? 'hidden' : ''}">
          ${getMailContent(data)}
        </div>
        
        <div id="htmlContent" class="mail-content ${bestViewMode === 'text' ? 'hidden' : ''}">
          <iframe id="htmlFrame" class="w-full border-0 min-h-[50vh]" sandbox="allow-same-origin"></iframe>
        </div>
        
        ${getAttachments(data.attachments)}
      `;
      
      // 如果选择显示HTML，加载HTML内容到iframe
      if (bestViewMode === 'html' && hasHtml) {
        const htmlFrame = document.getElementById('htmlFrame');
        const doc = htmlFrame.contentDocument || htmlFrame.contentWindow.document;
        doc.open();
        doc.write(`
          <base target="_blank">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              line-height: 1.5;
              color: #333;
              padding: 1rem;
              margin: 0;
              max-width: 100%;
            }
            img { max-width: 100%; height: auto; }
            a { color: #3b82f6; text-decoration: none; }
            a:hover { text-decoration: underline; }
          </style>
          ${data.html}
        `);
        doc.close();
        
        // 调整iframe高度以适应内容
        setTimeout(() => {
          try {
            const body = doc.body;
            htmlFrame.style.height = Math.max(body.scrollHeight, 300) + 'px';
          } catch (e) {
            console.error('调整iframe高度失败:', e);
          }
        }, 100);
      }
      
      // 如果有多种查看模式，绑定切换事件
      if (hasHtml && hasText) {
        document.getElementById('viewTextBtn')?.addEventListener('click', () => switchViewMode('text'));
        document.getElementById('viewHtmlBtn')?.addEventListener('click', () => switchViewMode('html'));
      }
      
    } catch (error) {
      console.error('加载邮件详情失败:', error);
      mailDetailEl.innerHTML = `<div class="p-6 text-center text-danger">加载失败: ${error.message}</div>`;
    }
  }
  
  // 切换显示模式
  function switchViewMode(mode) {
    if (!currentMailData) return;
    
    const textContent = document.getElementById('textContent');
    const htmlContent = document.getElementById('htmlContent');
    const viewTextBtn = document.getElementById('viewTextBtn');
    const viewHtmlBtn = document.getElementById('viewHtmlBtn');
    
    currentViewMode = mode;
    
    if (mode === 'text') {
      textContent.classList.remove('hidden');
      htmlContent.classList.add('hidden');
      viewTextBtn.classList.remove('btn-secondary');
      viewHtmlBtn.classList.add('btn-secondary');
    } else {
      textContent.classList.add('hidden');
      htmlContent.classList.remove('hidden');
      viewTextBtn.classList.add('btn-secondary');
      viewHtmlBtn.classList.remove('btn-secondary');
      
      // 如果还没有加载HTML，这时加载
      if (currentMailData.html) {
        const htmlFrame = document.getElementById('htmlFrame');
        if (!htmlFrame.contentDocument.body.innerHTML) {
          const doc = htmlFrame.contentDocument || htmlFrame.contentWindow.document;
          doc.open();
          doc.write(`
            <base target="_blank">
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                line-height: 1.5;
                color: #333;
                padding: 1rem;
                margin: 0;
                max-width: 100%;
              }
              img { max-width: 100%; height: auto; }
              a { color: #3b82f6; text-decoration: none; }
              a:hover { text-decoration: underline; }
            </style>
            ${currentMailData.html}
          `);
          doc.close();
          
          // 调整iframe高度以适应内容
          setTimeout(() => {
            try {
              const body = doc.body;
              htmlFrame.style.height = Math.max(body.scrollHeight, 300) + 'px';
            } catch (e) {
              console.error('调整iframe高度失败:', e);
            }
          }, 100);
        }
      }
    }
  }
  
  // 显示HTML内容（模态框方式 - 旧的功能保留）
  function showHtmlContent() {
    if (!currentMailData || !currentMailData.html) return;
    
    const doc = htmlPreview.contentDocument || htmlPreview.contentWindow.document;
    doc.open();
    doc.write(currentMailData.html);
    doc.close();
    
    htmlModal.classList.remove('hidden');
  }
  
  // 关闭HTML模态框
  function closeHtmlPreview() {
    htmlModal.classList.add('hidden');
  }
  
  // 格式化日期
  function formatDate(dateStr) {
    return dayjs(dateStr).format('MM-DD HH:mm');
  }
  
  // 完整格式化日期
  function formatFullDate(dateStr) {
    return dayjs(dateStr).format('YYYY-MM-DD HH:mm:ss');
  }
  
  // 获取邮件内容
  function getMailContent(mail) {
    // 如果有纯文本，优先显示
    if (mail.text) {
      return escapeHtml(mail.text);
    }
    
    // 如果有HTML，提取纯文本
    if (mail.html) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = mail.html;
      return escapeHtml(tempDiv.textContent || tempDiv.innerText || '(无内容)');
    }
    
    return '(无内容)';
  }
  
  // 附件处理
  function getAttachments(attachments) {
    if (!attachments || attachments.length === 0) {
      return '';
    }
    
    let html = '<div class="border-t border-gray-200 p-6"><h3 class="font-medium text-gray-700 mb-3">附件</h3><div class="grid grid-cols-1 md:grid-cols-2 gap-3">';
    
    attachments.forEach(attachment => {
      html += `
        <div class="flex items-center p-3 border border-gray-200 rounded">
          <i class='bx bx-paperclip text-gray-500 mr-2 text-xl'></i>
          <span class="text-sm truncate">${attachment.name}</span>
        </div>
      `;
    });
    
    html += '</div></div>';
    return html;
  }
  
  // 转义HTML
  function escapeHtml(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }
  
  // 初始化事件绑定
  function initEventListeners() {
    refreshBtn.addEventListener('click', loadMailList);
    closeHtmlModal.addEventListener('click', closeHtmlPreview);
    
    // 绑定认证表单提交事件
    authForm.addEventListener('submit', handleAuthSubmit);
    
    // 绑定查看模式选择事件
    viewModeSelect.addEventListener('change', function() {
      currentViewMode = this.value;
      // 如果已经选择了邮件，则重新加载以应用新的视图模式
      if (selectedMailId) {
        loadMailDetail(selectedMailId);
      }
      
      // 保存用户偏好到本地存储
      localStorage.setItem('viewMode', currentViewMode);
    });
    
    // 页面可见性变化时处理自动刷新状态
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        autoRefreshStatus.innerHTML = '自动刷新: <span class="text-success">活跃</span>';
        loadMailList(); // 页面变为可见时立即刷新一次
      } else {
        autoRefreshStatus.innerHTML = '自动刷新: <span class="text-gray">暂停</span>';
      }
    });
    
    // 点击模态框背景关闭
    htmlModal.addEventListener('click', (e) => {
      if (e.target === htmlModal) {
        closeHtmlPreview();
      }
    });
    
    // ESC键关闭模态框
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !htmlModal.classList.contains('hidden')) {
        closeHtmlPreview();
      }
    });
  }
  
  // 加载用户偏好设置
  function loadUserPreferences() {
    const savedViewMode = localStorage.getItem('viewMode');
    if (savedViewMode) {
      currentViewMode = savedViewMode;
      // 更新选择器值
      viewModeSelect.value = currentViewMode;
    }
  }
  
  // 开始认证流程
  initAuth();
}); 