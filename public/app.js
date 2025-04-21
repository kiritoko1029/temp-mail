document.addEventListener('DOMContentLoaded', () => {
  // 暴露关键函数到全局作用域，便于其他脚本直接调用
  window.refreshMailList = function() {
    console.log('通过全局函数调用刷新邮件列表');
    loadMailList();
  };
  
  window.initializeApp = function() {
    console.log('通过全局函数初始化应用');
    initApp();
  };
  
  window.startMailRefresh = function() {
    console.log('通过全局函数启动邮件自动刷新');
    startAutoRefresh();
  };
  
  // 打印调试信息
  console.log('=========== 应用初始化 ===========');
  console.log('localStorage authenticated:', localStorage.getItem('authenticated'));
  console.log('localStorage accessCode:', localStorage.getItem('accessCode'));
  
  // 初始化 dayjs
  dayjs.locale('zh-cn');
  
  // 全局状态管理
  const state = {
    authenticated: localStorage.getItem('authenticated') === 'true',
    emails: [],
    currentEmail: null,
    loading: false,
    error: null,
    accessCode: localStorage.getItem('accessCode') || '',
    autoRefreshInterval: null,
    viewMode: 'auto'
  };
  
  console.log('state authenticated:', state.authenticated);
  console.log('state accessCode:', state.accessCode);
  
  // DOM 元素
  const elements = {
    // 认证相关元素
    authScreen: document.getElementById('auth-screen'),
    authForm: document.getElementById('auth-form'),
    accessCodeInput: document.getElementById('access-code'),
    authError: document.getElementById('auth-error'),
    
    // 应用容器
    appContainer: document.getElementById('app-container'),
    
    // 邮件列表相关元素
    mailList: document.getElementById('mailList'),
    mailCount: document.getElementById('mailCount'),
    mailDetail: document.getElementById('mailDetail'),
    
    // 工具栏元素
    refreshBtn: document.getElementById('refreshBtn'),
    viewModeSelect: document.getElementById('viewModeSelect'),
    autoRefreshStatus: document.getElementById('autoRefreshStatus'),
    
    // HTML 预览模态框
    htmlModal: document.getElementById('htmlModal'),
    htmlPreview: document.getElementById('htmlPreview'),
    closeHtmlModal: document.getElementById('closeHtmlModal')
  };
  
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
  
  // 保存当前选中的邮件ID、配置和当前邮件数据
  let currentEmailId = null;
  let currentViewMode = 'auto'; // 'text', 'html', 'auto'
  let autoRefreshEnabled = true; // 默认启用自动刷新
  let refreshInterval;
  let currentEmailData = null;
  let appConfig = {}; // 添加appConfig变量
  
  console.log('初始化认证状态:', state.authenticated);
  
  // 初始化应用
  function initApp() {
    console.log('初始化应用');
    // 确保模态框在初始化时是隐藏的
    elements.htmlModal.style.display = 'none';
    elements.htmlModal.classList.add('hidden');
    elements.htmlModal.classList.remove('show');
    
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
      console.log('加载服务器配置');
      const response = await fetch('/api/config');
      if (!response.ok) {
        throw new Error('服务器配置请求失败: ' + response.status);
      }
      appConfig = await response.json();
      console.log('服务器配置加载成功:', appConfig);
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  }
  
  // 启动自动刷新
  function startAutoRefresh() {
    console.log('启动自动刷新功能');
    
    // 清除现有的定时器
    if (refreshInterval) {
      clearInterval(refreshInterval);
      console.log('清除现有的刷新定时器');
    }
    
    console.log('设置每5秒自动刷新一次邮件列表');
    
    // 每5秒刷新一次
    refreshInterval = setInterval(() => {
      const autoRefreshStatus = document.getElementById('autoRefreshStatus');
      
      console.log('自动刷新触发, 页面可见状态:', document.visibilityState);
      
      if (document.visibilityState === 'visible') {
        console.log('页面可见，执行邮件列表刷新');
        loadMailList();
        if (autoRefreshStatus) {
          autoRefreshStatus.innerHTML = '自动刷新: <span class="text-success">活跃</span>';
        }
      } else {
        console.log('页面不可见，暂停刷新');
        if (autoRefreshStatus) {
          autoRefreshStatus.innerHTML = '自动刷新: <span class="text-gray">暂停</span>';
        }
      }
    }, 5000);
    
    // 立即执行一次刷新
    console.log('立即执行首次邮件列表刷新');
    loadMailList();
  }
  
  // 加载邮件列表
  async function loadMailList() {
    console.log('开始加载邮件列表');
    
    const mailListEl = document.getElementById('mailList');
    const mailCountEl = document.getElementById('mailCount');
    const currentEmailEl = document.getElementById('currentEmail') || { textContent: '' };
    
    if (!mailListEl) {
      console.error('未找到邮件列表元素');
      return;
    }
    
    try {
      // 只有在第一次加载时显示加载动画，避免频繁刷新时闪烁
      if (!mailListEl.innerHTML || mailListEl.innerHTML.includes('没有邮件')) {
        mailListEl.innerHTML = '<div class="p-4 text-center"><div class="loading mx-auto"></div><p class="mt-4 text-gray">加载邮件列表中...</p></div>';
      }
      
      console.log('发送获取邮件列表请求');
      const response = await fetch('/api/mails');
      
      if (!response.ok) {
        throw new Error('邮件列表请求失败: ' + response.status);
      }
      
      const data = await response.json();
      console.log('获取到邮件列表数据:', data);
      
      if (!data.result) {
        throw new Error('获取邮件失败');
      }
      
      // 更新邮箱地址(如果API返回了)和邮件数量
      if (data.mail_list && data.mail_list.length > 0 && data.mail_list[0].to) {
        currentEmailEl.textContent = `当前邮箱: ${data.mail_list[0].to}`;
      }
      
      if (mailCountEl) {
        mailCountEl.textContent = `共 ${data.count || 0} 封邮件`;
      }
      
      // 清空列表
      mailListEl.innerHTML = '';
      
      if (!data.mail_list || data.mail_list.length === 0) {
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
        
        mailItem.addEventListener('click', () => {
          console.log('邮件项被点击, ID:', mail.mail_id);
          loadMailDetail(mail.mail_id);
        });
        
        mailListEl.appendChild(mailItem);
      });
      
      // 如果之前有选中的邮件，保持其选中状态
      if (currentEmailId) {
        document.querySelectorAll('.mail-item').forEach(item => {
          item.classList.toggle('active', item.dataset.id == currentEmailId);
        });
      }
      
      console.log('邮件列表加载完成');
      
    } catch (error) {
      console.error('加载邮件列表失败:', error);
      if (mailListEl) {
        mailListEl.innerHTML = `<div class="p-4 text-center text-danger">加载失败: ${error.message}</div>`;
      }
    }
  }
  
  // 加载邮件详情
  async function loadMailDetail(mailId) {
    try {
      // 更新选中状态
      currentEmailId = mailId;
      document.querySelectorAll('.mail-item').forEach(item => {
        item.classList.toggle('active', item.dataset.id == mailId);
      });
      
      // 显示加载状态
      mailDetailEl.innerHTML = '<div class="p-6 text-center"><div class="loading mx-auto"></div><p class="mt-4 text-gray">加载邮件内容中...</p></div>';
      
      const response = await fetch(`/api/mails/${mailId}`);
      if (!response.ok) {
        throw new Error('邮件详情请求失败: ' + response.status);
      }
      
      const data = await response.json();
      
      if (!data.result) {
        throw new Error('获取邮件详情失败');
      }
      
      // 保存当前邮件数据用于HTML预览
      currentEmailData = data;
      
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
    if (!currentEmailData) return;
    
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
      if (currentEmailData.html) {
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
            ${currentEmailData.html}
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
    if (!currentEmailData || !currentEmailData.html) return;
    
    const doc = htmlPreview.contentDocument || htmlPreview.contentWindow.document;
    doc.open();
    doc.write(currentEmailData.html);
    doc.close();
    
    htmlModal.classList.remove('hidden');
    htmlModal.classList.add('show');
    htmlModal.style.display = 'flex';
  }
  
  // 关闭HTML模态框
  function closeHtmlPreview() {
    htmlModal.classList.add('hidden');
    htmlModal.classList.remove('show');
    htmlModal.style.display = 'none';
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
    console.log('初始化事件监听器');
    
    // 绑定验证按钮点击事件
    const submitBtn = document.getElementById('submit-btn');
    console.log('找到提交按钮:', submitBtn);
    
    if (submitBtn) {
      submitBtn.addEventListener('click', function(e) {
        console.log('验证按钮被点击');
        handleAuthFormSubmit(e);
      });
      console.log('成功绑定验证按钮点击事件');
    } else {
      console.error('没有找到ID为submit-btn的按钮元素');
    }
    
    // 绑定刷新按钮点击事件
    const refreshButton = document.getElementById('refreshBtn');
    if (refreshButton) {
      console.log('找到刷新按钮, 绑定点击事件');
      refreshButton.addEventListener('click', function() {
        console.log('点击刷新按钮');
        loadMailList();
      });
    } else {
      console.error('未找到刷新按钮元素');
    }
    
    // 其他事件绑定...
    const closeModalBtn = document.getElementById('closeHtmlModal');
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', closeHtmlPreview);
    }
    
    // 绑定输入框Enter键提交
    if (elements.accessCodeInput) {
      elements.accessCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          console.log('检测到Enter键，触发验证');
          handleAuthFormSubmit(e);
        }
      });
    }
    
    // 绑定查看模式选择事件
    const viewModeSelect = document.getElementById('viewModeSelect');
    if (viewModeSelect) {
      viewModeSelect.addEventListener('change', function() {
        currentViewMode = this.value;
        // 如果已经选择了邮件，则重新加载以应用新的视图模式
        if (currentEmailId) {
          loadMailDetail(currentEmailId);
        }
        
        // 保存用户偏好到本地存储
        localStorage.setItem('viewMode', currentViewMode);
      });
    }
    
    // 页面可见性变化时处理自动刷新状态
    document.addEventListener('visibilitychange', () => {
      const statusElement = document.getElementById('autoRefreshStatus');
      if (!statusElement) return;
      
      if (document.visibilityState === 'visible') {
        statusElement.innerHTML = '自动刷新: <span class="text-success">活跃</span>';
        loadMailList(); // 页面变为可见时立即刷新一次
      } else {
        statusElement.innerHTML = '自动刷新: <span class="text-gray">暂停</span>';
      }
    });
    
    // 点击模态框背景关闭
    const htmlModal = document.getElementById('htmlModal');
    if (htmlModal) {
      htmlModal.addEventListener('click', (e) => {
        if (e.target === htmlModal) {
          closeHtmlPreview();
        }
      });
    }
    
    // ESC键关闭模态框
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.getElementById('htmlModal') && 
          !document.getElementById('htmlModal').classList.contains('hidden')) {
        closeHtmlPreview();
      }
    });
  }
  
  // 加载用户偏好设置
  function loadUserPreferences() {
    console.log('加载用户偏好设置');
    const savedViewMode = localStorage.getItem('viewMode');
    if (savedViewMode) {
      currentViewMode = savedViewMode;
      // 更新选择器值
      elements.viewModeSelect.value = currentViewMode;
    }
  }
  
  // 处理认证表单提交
  async function handleAuthFormSubmit(e) {
    if (e) e.preventDefault();
    
    // 获取访问码
    const accessCode = elements.accessCodeInput.value.trim();
    if (!accessCode) {
      showAuthError('请输入访问码');
      return;
    }
    
    // 清除错误，显示加载状态
    hideAuthError();
    state.loading = true;
    
    // 显示加载状态
    const authButton = document.getElementById('submit-btn');
    const originalButtonText = authButton.innerHTML;
    authButton.innerHTML = '<div class="loading-sm mx-auto"></div>';
    authButton.disabled = true;
    
    try {
      console.log('正在验证访问码:', accessCode);
      const success = await verifyAccessCode(accessCode);
      console.log('验证结果:', success);
      
      if (success) {
        // 保存访问码和认证状态
        state.accessCode = accessCode;
        state.authenticated = true;
        localStorage.setItem('accessCode', accessCode);
        localStorage.setItem('authenticated', 'true');
        
        // 隐藏认证界面，显示应用界面
        showApp();
        
        // 初始化应用
        initApp();
      } else {
        showAuthError('访问码无效，请重试');
        elements.authForm.classList.add('shake');
        setTimeout(() => {
          elements.authForm.classList.remove('shake');
        }, 500);
      }
    } catch (error) {
      console.error('验证失败:', error);
      showAuthError('认证失败: ' + error.message);
      elements.authForm.classList.add('shake');
      setTimeout(() => {
        elements.authForm.classList.remove('shake');
      }, 500);
    } finally {
      state.loading = false;
      // 恢复按钮状态
      authButton.innerHTML = originalButtonText;
      authButton.disabled = false;
    }
  }
  
  // 验证访问码
  async function verifyAccessCode(code) {
    try {
      console.log('发送验证请求，code:', code);
      
      if (!code) {
        console.error('验证码为空');
        throw new Error('请输入验证码');
      }
      
      const response = await fetch('/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      
      console.log('验证响应状态:', response.status);
      
      // 尝试解析响应为JSON，无论成功或失败
      let jsonData;
      try {
        jsonData = await response.json();
        console.log('验证响应数据:', jsonData);
      } catch (e) {
        console.error('解析响应数据失败:', e);
        throw new Error('服务器响应无效');
      }
      
      if (!response.ok) {
        throw new Error(jsonData.message || '验证请求失败: ' + response.status);
      }
      
      return jsonData.success === true;
    } catch (error) {
      console.error('验证访问码失败:', error);
      throw error;
    }
  }
  
  // 显示认证错误
  function showAuthError(message) {
    elements.authError.textContent = message;
    elements.authError.style.display = 'block';
    elements.authError.classList.remove('hidden');
  }
  
  // 隐藏认证错误
  function hideAuthError() {
    elements.authError.textContent = '';
    elements.authError.style.display = 'none';
    elements.authError.classList.add('hidden');
  }
  
  // 显示应用界面
  function showApp() {
    console.log('显示应用界面');
    try {
      // 使用直接的DOM操作而不是classList
      elements.authScreen.style.display = 'none';
      elements.appContainer.style.display = 'block';
      
      // 确保存储了认证状态
      if (state.authenticated && state.accessCode) {
        localStorage.setItem('accessCode', state.accessCode);
        localStorage.setItem('authenticated', 'true');
        console.log('认证状态已保存到localStorage');
      }
    } catch (error) {
      console.error('显示应用界面时出错:', error);
    }
  }
  
  // 开始认证流程
  console.log('应用加载完成，开始认证流程');
  
  // 检查是否已经认证
  if (state.authenticated && state.accessCode) {
    // 验证本地存储的访问码
    verifyAccessCode(state.accessCode)
      .then(success => {
        if (success) {
          showApp();
          initApp();
        } else {
          // 验证失败，清除本地存储
          localStorage.removeItem('authenticated');
          localStorage.removeItem('accessCode');
          state.authenticated = false;
          state.accessCode = '';
          elements.authScreen.style.display = 'flex';
          elements.appContainer.style.display = 'none';
        }
      })
      .catch(() => {
        // 验证出错，显示登录界面
        localStorage.removeItem('authenticated');
        localStorage.removeItem('accessCode');
        state.authenticated = false;
        state.accessCode = '';
        elements.authScreen.style.display = 'flex';
        elements.appContainer.style.display = 'none';
      });
  } else {
    elements.authScreen.style.display = 'flex';
    elements.appContainer.style.display = 'none';
  }
}); 