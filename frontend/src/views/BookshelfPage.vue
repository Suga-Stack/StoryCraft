<template>
  <div class="bookshelf-container">
    <!-- 顶部导航栏 -->
    <header class="header">
      <h1>{{ currentFolder ? currentFolder.name : '我的书架' }}</h1>
      <div class="header-actions">
        <button @click="showSearch = !showSearch" class="icon-btn">
          <i class="search-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="searchGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#C49796" />
                  <stop offset="100%" stop-color="#54494B" stop-opacity="0.85" />
                </linearGradient>
              </defs>
              
              <g transform="translate(0, 0.2)">
                <circle cx="10" cy="9.5" r="6" stroke="url(#searchGradient)" stroke-width="3" fill="transparent"/>
                <path d="M17 16L20 20" stroke="url(#searchGradient)" stroke-width="3" stroke-linecap="round"/>
              </g>
            </svg>
          </i>
          <span class="txt">搜索</span>
        </button>
        <button 
          @click="() => { showCreateFolderDialog = true }" 
          class="icon-btn" 
          v-if="!currentFolder"
        >
          <i class="add-folder-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <!-- 定义渐变 -->
              <defs>
                <linearGradient id="plusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#C49796" stop-opacity="1" />
                  <stop offset="100%" stop-color="#54494B" stop-opacity="0.85" />
                </linearGradient>
              </defs>
              <!-- 圆形背景 -->
              <circle cx="12" cy="12" r="10" stroke="url(#plusGradient)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="transparent"/>
              <!-- 横向线 -->
              <path d="M8 12H16" stroke="#C49796" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
              <!-- 纵向线 -->
              <path d="M12 8V16" stroke="#C49796" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </i>
          <span class="txt">新建</span>
        </button>
        <button @click="goBack" class="icon-btn" v-if="currentFolder">
          <i class="back-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="backGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#C49796" stop-opacity="1" />
                  <stop offset="100%" stop-color="#54494B" stop-opacity="0.85" />
                </linearGradient>
              </defs>
              
              <!-- 左箭头图标 -->
              <path d="M15 19L9 13L15 7" 
                    stroke="url(#backGradient)" 
                    stroke-width="3" 
                    stroke-linecap="round" 
                    stroke-linejoin="round"/>
            </svg>
          </i>
          <span class="txt">返回</span>
        </button>
        <!-- 批量管理按钮 -->
        <button @click="toggleBatchMode" class="icon-btn">
          <i class="batch-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="batchNewGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#C49796" stop-opacity="1" />
                  <stop offset="100%" stop-color="#54494B" stop-opacity="0.85" />
                </linearGradient>
              </defs>
              
              <!-- 编辑模式图标 (铅笔) -->
              <g v-if="!isBatchMode">
                <!-- 铅笔主体 -->
                <path d="M3 17.25V21H6.75L17.81 9.94L14.06 6.19L3 17.25Z" 
                      stroke="url(#batchNewGradient)" 
                      stroke-width="3" 
                      stroke-linecap="round" 
                      stroke-linejoin="round" 
                      fill="none"/>
                <!-- 铅笔尖 -->
                <path d="M15.5 4L19 7.5" 
                      stroke="url(#batchNewGradient)" 
                      stroke-width="3" 
                      stroke-linecap="round" 
                      stroke-linejoin="round"/>
              </g>
              
              <!-- 批量模式图标 (勾选) -->
              <path v-if="isBatchMode" d="M7 11L10 14L17 7" 
                    stroke="url(#batchNewGradient)" 
                    stroke-width="4" 
                    stroke-linecap="round" 
                    stroke-linejoin="round"/>
            </svg>
          </i>
          <span class="txt">管理</span>
        </button>
      </div>
    </header>

    <!-- 搜索框 -->
    <div class="search-container" v-if="showSearch">
      <input
        type="text"
        v-model="searchQuery"
        placeholder="搜索收藏作品..."
        class="search-input"
        @input="handleSearch"
      >
      <button @click="searchQuery = ''" class="clear-search" v-if="searchQuery">
        ×
      </button>
    </div>

    <!-- 批量操作栏 -->
    <div class="batch-actions" v-if="isBatchMode && selectedBooks.length">
      <button @click="showAddToFolderDialog = true" class="batch-btn">
        加入收藏夹
      </button>
      <button @click="removeSelectedFromFolder" class="batch-btn remove-btn">
        从收藏夹移除
      </button>
      <button @click="cancelBatchMode" class="batch-btn cancel-btn">
        取消
      </button>
    </div>

    <!-- 收藏夹列表（仅在书架根目录显示） -->
    <div class="folders-section" v-if="!currentFolder && folders.length">
      <h2 class="section-title">我的收藏夹</h2>
      <div class="folders-grid">
        <div 
          class="folder-item" 
          v-for="folder in folders" 
          :key="folder.id"
          @click="enterFolder(folder)"
        >
          <div class="folder-icon">
            <svg viewBox="0 0 149 118.559" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="149.000000" height="118.559143" fill="none" customFrame="#000000">
              <defs>
                <linearGradient id="paint_linear_10" x1="-6.81700134" x2="18.0767365" y1="54.9272499" y2="-9.60156631" gradientUnits="userSpaceOnUse">
                  <stop stop-color="rgb(184,132,132)" offset="0" stop-opacity="1" />
                  <stop stop-color="rgb(204,147,147)" offset="1" stop-opacity="1" />
                </linearGradient>
                <g id="pixso_custom_effect_5"></g>
                <filter id="filter_5" width="149.000000" height="118.559143" x="0.000000" y="0.000000" filterUnits="userSpaceOnUse" customEffect="url(#pixso_custom_effect_5)" color-interpolation-filters="sRGB">
                  <feFlood flood-opacity="0" result="BackgroundImageFix" />
                  <feBlend result="shape" in="SourceGraphic" in2="BackgroundImageFix" mode="normal" />
                  <feColorMatrix result="hardAlpha" in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 2.38095 0 " />
                  <feOffset dx="0.000000" dy="0.000000" in="hardAlpha" />
                  <feGaussianBlur stdDeviation="1.33333337" />
                  <feComposite k2="-1" k3="1" in2="hardAlpha" operator="arithmetic" />
                  <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.63 0 " />
                  <feBlend result="effect_innerShadow_1" in2="shape" mode="normal" />
                </filter>
                <clipPath id="outline_mask_2" transform="matrix(1,0,0,1,-0,-0)">
                  <path d="M0 20.4274C0 9.14568 9.14567 0 20.4274 0L51.773 0C59.1855 0 66.0772 3.81176 70.0169 10.0907C74.0527 16.5227 81.1124 20.4274 88.7057 20.4274L134.119 20.4274C142.337 20.4274 149 27.09 149 35.3088L149 94.5592C149 107.814 138.255 118.559 125 118.559L24 118.559C10.7452 118.559 0 107.814 0 94.5591L0 20.4274Z" fill="rgb(255,255,255)" fill-rule="evenodd" />
                </clipPath>
                <linearGradient id="paint_linear_11" x1="74.5" x2="74.5" y1="0" y2="121.295715" gradientUnits="userSpaceOnUse">
                  <stop stop-color="rgb(212,165,165)" offset="0" stop-opacity="0.419999987" />
                  <stop stop-color="rgb(184,132,132)" offset="1" stop-opacity="0.48999998" />
                </linearGradient>
                <linearGradient id="paint_linear_12" x1="74.5000076" x2="74.5000076" y1="0" y2="22.8306446" gradientUnits="userSpaceOnUse">
                  <stop stop-color="rgb(255,255,255)" offset="0" stop-opacity="0.360000014" />
                  <stop stop-color="rgb(255,255,255)" offset="1" stop-opacity="0" />
                </linearGradient>
                <linearGradient id="paint_linear_13" x1="-3.84096575" x2="154.542023" y1="85.7922745" y2="79.4541931" gradientUnits="userSpaceOnUse">
                  <stop stop-color="rgb(212,165,165)" offset="0" stop-opacity="1" />
                  <stop stop-color="rgb(254.483,251.812,255)" offset="1" stop-opacity="1" />
                </linearGradient>
                <g id="pixso_custom_effect_6"></g>
                <filter id="filter_6" width="71.285034" height="35.236572" x="26.415527" y="37.459961" filterUnits="userSpaceOnUse" customEffect="url(#pixso_custom_effect_6)" color-interpolation-filters="sRGB">
                  <feFlood flood-opacity="0" result="BackgroundImageFix" />
                  <feColorMatrix result="hardAlpha" in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 7.14286 0 " />
                  <feOffset dx="0.000000" dy="4.000000" in="hardAlpha" />
                  <feGaussianBlur stdDeviation="1.33333337" />
                  <feComposite k2="-1" k3="1" in2="hardAlpha" operator="out" />
                  <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0 " />
                  <feBlend result="effect_dropShadow_1" in2="BackgroundImageFix" mode="normal" />
                  <feBlend result="shape" in="SourceGraphic" in2="effect_dropShadow_1" mode="normal" />
                </filter>
                <linearGradient id="paint_linear_14" x1="28.7841492" x2="95.7952957" y1="57.1690063" y2="52.2111549" gradientUnits="userSpaceOnUse">
                  <stop stop-color="rgb(212,165,165)" offset="0" stop-opacity="1" />
                  <stop stop-color="rgb(254.483,251.812,255)" offset="1" stop-opacity="1" />
                </linearGradient>
              </defs>
              <rect id="folder" width="149.000000" height="118.559143" x="0.000000" y="0.000000" />
              <path id="shape" d="M15.4617 31.6635C15.4617 19.5133 25.3114 9.66351 37.4617 9.66351L113.289 9.66351C125.44 9.66351 135.289 19.5133 135.289 31.6635L135.289 74.6352C135.289 86.7855 125.44 96.6353 113.289 96.6353L37.4617 96.6353C25.3114 96.6353 15.4617 86.7855 15.4617 74.6353L15.4617 31.6635Z" fill="url(#paint_linear_10)" fill-rule="evenodd" />
              <g data-pixso-skip-parse="true">
                <foreignObject width="149.000000" height="118.559143" x="0.000000" y="0.000000">
                </foreignObject>
              </g>
              <g filter="url(#filter_5)">
                <path id="shape" d="M0 20.4274C0 9.14568 9.14567 2.27374e-13 20.4274 2.27374e-13L51.773 0C59.1855 8.64316e-14 66.0772 3.81176 70.0169 10.0907C74.0527 16.5227 81.1124 20.4274 88.7057 20.4274L134.119 20.4274C142.337 20.4274 149 27.09 149 35.3088L149 94.5592C149 107.814 138.255 118.559 125 118.559L24 118.559C10.7452 118.559 0 107.814 0 94.5591L0 20.4274Z" fill="url(#paint_linear_11)" fill-rule="evenodd" />
                <path id="shape" d="M0 20.4274C0 9.14568 9.14567 2.27374e-13 20.4274 2.27374e-13L51.773 0C59.1855 8.64316e-14 66.0772 3.81176 70.0169 10.0907C74.0527 16.5227 81.1124 20.4274 88.7057 20.4274L134.119 20.4274C142.337 20.4274 149 27.09 149 35.3088L149 94.5592C149 107.814 138.255 118.559 125 118.559L24 118.559C10.7452 118.559 0 107.814 0 94.5591L0 20.4274Z" fill="url(#paint_linear_12)" fill-opacity="0" fill-rule="evenodd" />
                <path id="shape" d="M20.4274 0C9.14567 0 0 9.14568 0 20.4274L0 94.5591C0 107.814 10.7452 118.559 24 118.559L125 118.559C138.255 118.559 149 107.814 149 94.5592L149 35.3088C149 27.09 142.337 20.4274 134.119 20.4274L88.7057 20.4274C81.1124 20.4274 74.0527 16.5227 70.0169 10.0907C66.0772 3.81176 59.1855 0 51.773 0L20.4274 0ZM148 35.3088L148 94.5592Q148 97.1618 147.441 99.6384Q146.995 101.615 146.193 103.512Q145.376 105.442 144.245 107.166Q142.958 109.128 141.263 110.823Q139.569 112.517 137.607 113.804Q135.883 114.936 133.952 115.752Q132.055 116.555 130.078 117.001Q127.602 117.559 125 117.559L24 117.559Q21.3985 117.559 18.9229 117.001Q16.9451 116.555 15.0477 115.752Q13.1169 114.935 11.3927 113.804Q9.43097 112.517 7.73654 110.823Q6.04195 109.128 4.75476 107.166Q3.62359 105.442 2.80704 103.511Q2.00464 101.614 1.55854 99.6369Q1 97.161 1 94.5591L1 20.4274Q1 18.2279 1.47252 16.135Q1.84924 14.4664 2.52629 12.8657Q3.21576 11.2356 4.17083 9.77975Q5.25832 8.12201 6.69016 6.69016Q8.12201 5.25831 9.77976 4.17081Q11.2356 3.21576 12.8657 2.52629Q14.4664 1.84924 16.135 1.47252Q18.2279 0.999998 20.4274 0.999998L51.773 1Q54.4236 1 56.9087 1.64146Q59.3938 2.28291 61.7132 3.56581Q64.0325 4.84861 65.8966 6.61251Q67.7609 8.3767 69.1698 10.6221Q70.7519 13.1436 72.8455 15.1247Q74.9387 17.1056 77.5432 18.5461Q80.1477 19.9867 82.9382 20.707Q85.729 21.4274 88.7057 21.4274L134.119 21.4274Q135.693 21.4274 137.191 21.7663Q138.381 22.0353 139.522 22.5179Q140.685 23.0101 141.725 23.6917Q142.91 24.4692 143.934 25.4932Q144.958 26.5171 145.736 27.7027Q146.417 28.7422 146.91 29.9058Q147.392 31.0462 147.661 32.2348Q148 33.7334 148 35.3088Z" fill="url(#paint_linear_13)" fill-rule="evenodd" />
              </g>
              <path id="shape" d="M20.4274 0C9.14567 0 0 9.14568 0 20.4274L0 94.5591C0 107.814 10.7452 118.559 24 118.559L125 118.559C138.255 118.559 149 107.814 149 94.5592L149 35.3088C149 27.09 142.337 20.4274 134.119 20.4274L88.7057 20.4274C81.1124 20.4274 74.0527 16.5227 70.0169 10.0907C66.0772 3.81176 59.1855 0 51.773 0L20.4274 0ZM148 35.3088L148 94.5592Q148 97.1618 147.441 99.6384Q146.995 101.615 146.193 103.512Q145.376 105.442 144.245 107.166Q142.958 109.128 141.263 110.823Q139.569 112.517 137.607 113.804Q135.883 114.936 133.952 115.752Q132.055 116.555 130.078 117.001Q127.602 117.559 125 117.559L24 117.559Q21.3985 117.559 18.9229 117.001Q16.9451 116.555 15.0477 115.752Q13.1169 114.935 11.3927 113.804Q9.43097 112.517 7.73654 110.823Q6.04195 109.128 4.75476 107.166Q3.62359 105.442 2.80704 103.511Q2.00464 101.614 1.55854 99.6369Q1 97.161 1 94.5591L1 20.4274Q1 18.2279 1.47252 16.135Q1.84924 14.4664 2.52629 12.8657Q3.21576 11.2356 4.17083 9.77975Q5.25832 8.12201 6.69016 6.69016Q8.12201 5.25831 9.77976 4.17081Q11.2356 3.21576 12.8657 2.52629Q14.4664 1.84924 16.135 1.47252Q18.2279 0.999998 20.4274 0.999998L51.773 1Q54.4236 1 56.9087 1.64146Q59.3938 2.28291 61.7132 3.56581Q64.0325 4.84861 65.8966 6.61251Q67.7609 8.3767 69.1698 10.6221Q70.7519 13.1436 72.8455 15.1247Q74.9387 17.1056 77.5432 18.5461Q80.1477 19.9867 82.9382 20.707Q85.729 21.4274 88.7057 21.4274L134.119 21.4274Q135.693 21.4274 137.191 21.7663Q138.381 22.0353 139.522 22.5179Q140.685 23.0101 141.725 23.6917Q142.91 24.4692 143.934 25.4932Q144.958 26.5171 145.736 27.7027Q146.417 28.7422 146.91 29.9058Q147.392 31.0462 147.661 32.2348Q148 33.7334 148 35.3088Z" fill="url(#paint_linear_13)" fill-rule="evenodd" data-pixso-skip-parse="true" />
              <path id="shape" d="M0 94.5591C0 94.5617 3.99757e-07 94.5643 1.19921e-06 94.5668C0.00221442 101.644 3.06774 108.005 7.94271 112.397C16.9325 99.551 36.0973 82.1489 76.9534 66.3313C114.25 51.8918 133.164 35.8678 142.753 23.187C140.318 21.4495 137.338 20.4274 134.119 20.4274L88.7057 20.4274C81.1124 20.4274 74.0527 16.5227 70.0169 10.0907C66.0772 3.81176 59.1855 0 51.773 0L29.1938 0C13.0802 0 0.0157092 11.2527 8.24084e-06 25.1388L0 94.5591Z" fill="rgb(255,255,255)" fill-opacity="0.0900000036" fill-rule="evenodd" />
              <g filter="url(#filter_6)">
                <path id="shape" d="M30.4156 42.2664C30.4156 39.6119 32.5675 37.46 35.222 37.46L88.8941 37.46C91.5486 37.46 93.7005 39.6119 93.7005 42.2664C93.7005 44.9209 91.5486 47.0729 88.8941 47.0729L35.222 47.0729C32.5675 47.0729 30.4156 44.9209 30.4156 42.2664ZM30.4155 59.8901C30.4155 57.2355 32.5674 55.0836 35.222 55.0836L69.6682 55.0836C72.3228 55.0836 74.4747 57.2355 74.4747 59.8901C74.4747 62.5446 72.3227 64.6965 69.6682 64.6965L35.222 64.6965C32.5674 64.6965 30.4155 62.5446 30.4155 59.8901Z" fill="url(#paint_linear_14)" fill-rule="evenodd" />
                <path id="shape" d="M35.222 37.46C32.5675 37.46 30.4156 39.6119 30.4156 42.2664C30.4156 44.9209 32.5675 47.0729 35.222 47.0729L88.8941 47.0729C91.5486 47.0729 93.7005 44.9209 93.7005 42.2664C93.7005 39.6119 91.5486 37.46 88.8941 37.46L35.222 37.46ZM31.6943 43.7277Q31.4156 43.0548 31.4156 42.2664Q31.4156 41.4781 31.6943 40.8052Q31.973 40.1323 32.5304 39.5748Q33.0879 39.0174 33.7608 38.7387Q34.4337 38.46 35.222 38.46L88.8941 38.46Q89.6824 38.46 90.3553 38.7387Q91.0282 39.0174 91.5856 39.5748Q92.1431 40.1323 92.4218 40.8052Q92.7005 41.4781 92.7005 42.2664Q92.7005 43.0548 92.4218 43.7277Q92.1431 44.4005 91.5856 44.958Q91.0282 45.5154 90.3553 45.7941Q89.6824 46.0729 88.8941 46.0729L35.222 46.0729Q34.4337 46.0729 33.7608 45.7941Q33.0879 45.5154 32.5304 44.958Q31.973 44.4005 31.6943 43.7277ZM35.222 55.0836C32.5674 55.0836 30.4155 57.2355 30.4155 59.8901C30.4155 62.5446 32.5674 64.6965 35.222 64.6965L69.6682 64.6965C72.3227 64.6965 74.4747 62.5446 74.4747 59.8901C74.4747 57.2355 72.3228 55.0836 69.6682 55.0836L35.222 55.0836ZM31.6942 61.3513Q31.4155 60.6784 31.4155 59.8901Q31.4155 59.1017 31.6942 58.4289Q31.973 57.756 32.5304 57.1985Q33.0879 56.6411 33.7607 56.3624Q34.4336 56.0836 35.222 56.0836L69.6682 56.0836Q70.4566 56.0836 71.1294 56.3623Q71.8023 56.6411 72.3598 57.1985Q72.9172 57.7559 73.1959 58.4288Q73.4747 59.1017 73.4747 59.8901Q73.4747 60.6784 73.1959 61.3513Q72.9172 62.0242 72.3598 62.5816Q71.8023 63.1391 71.1295 63.4178Q70.4566 63.6965 69.6682 63.6965L35.222 63.6965Q34.4336 63.6965 33.7607 63.4178Q33.0878 63.1391 32.5304 62.5816Q31.973 62.0242 31.6942 61.3513Z" fill="rgb(255,255,255)" fill-opacity="0.140000001" fill-rule="evenodd" />
              </g>
            </svg>
          </div>
          <div class="folder-name">{{ folder.name }}</div>
          <div class="folder-count">{{ getFolderBookCount(folder.id) }}本</div>
          <span 
            @click.stop="openDeleteFolderDialog(folder.id)" 
            class="folder-delete-icon"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="#ff4d4f"/>
            </svg>
          </span>
        </div>
      </div>
    </div>

    <!-- 书籍列表 -->
    <div class="books-section">
      <h2 class="section-title">
        {{ currentFolder ? currentFolder.name + ' 中的书籍' : '未分类书籍' }}
        <span class="count">({{ filteredBooks.length }})</span>
      </h2>
      
      <div class="books-grid" v-if="filteredBooks.length">
        <div 
          class="book-item" 
          v-for="book in filteredBooks" 
          :key="book.id"
          @click="isBatchMode ? toggleSelectBook(book) : openReader(book.gameworkId)"
        >
          <!-- 批量选择框 -->
          <div class="batch-select" v-if="isBatchMode">
            <input 
              type="checkbox" 
              v-model="selectedBooks" 
              :value="book"
              @click.stop
            >
          </div>
          
          <div class="book-cover" 
            :style="{ backgroundImage: `url(${book.cover})` }"></div>
            <div class="book-info-grid">
              <div class="book-info">
                <div class="book-title">{{ book.title }}</div>
              </div>
              
              <div class="btn-group">
                <!-- 收藏状态按钮 -->
                <van-icon 
                  :name="book.isFavorite ? 'star' : 'star-o'" 
                  class="favorite-icon"
                  :class="{ active: book.isFavorite }"
                  @click.stop="handleFavorite(book)"
                />
                
                <!-- 收藏夹操作按钮 -->
                <van-icon 
                  :name="book.folderId ? 'clear' : 'plus'" 
                  class="folder-action-icon"
                  :class="{ 'in-folder': book.folderId }"
                  @click.stop="handleFolderAction(book)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="empty-state" v-if="!filteredBooks.length">
        <p>{{ searchQuery ? '没有找到匹配的书籍' : '这里还是空的哦' }}</p>
        <p v-if="!currentFolder">添加书籍到书架吧~</p>
      </div>
    </div>

    <!-- 移除确认对话框 -->
    <div class="dialog-overlay" v-if="showRemoveFromFolderDialog">
      <div class="dialog">
        <h3>从收藏夹移除</h3>
        <p>确定要将《{{ currentBook?.title }}》从收藏夹中移除吗？</p>
        <div class="dialog-actions">
          <button @click="showRemoveFromFolderDialog = false" class="cancel-btn">取消</button>
          <button 
            @click="confirmRemoveFromFolder(); showRemoveFromFolderDialog = false" 
            class="confirm-btn"
          >
            确认移除
          </button>
        </div>
      </div>
    </div>

    <!-- 创建收藏夹弹窗 -->
    <div class="dialog-overlay" v-if="showCreateFolderDialog">
      <div class="dialog">
        <h3>创建新收藏夹</h3>
        <van-field
          v-model="folderName"
          placeholder="请输入收藏夹名称"
          clearable
          class="folder-input"
        />
        <div class="dialog-actions">
          <button @click="showCreateFolderDialog = false" class="cancel-btn">取消</button>
          <button 
            @click="handleCreateFolder"
            class="confirm-btn"
            :style="{ 
              background: 'linear-gradient(135deg, #d4a5a5 0%, #b88484 100%)',
              border: 'none'
            }"
          >
            创建
          </button>
        </div>
      </div>
    </div>

    <!-- 添加到收藏夹对话框 -->
    <div class="dialog-overlay" v-if="showAddToFolderDialog">
      <div class="dialog">
        <h3>{{ currentBook ? '添加到收藏夹' : '批量添加到收藏夹' }}</h3>
        <select 
          v-model="selectedFolderId" 
          class="folder-select"
          @change.stop
        >
          <option value="">-- 选择收藏夹 --</option>
          <option 
            v-for="folder in folders" 
            :key="folder.id" 
            :value="folder.id"
          >
            {{ folder.name }}
          </option>
        </select>
        <div class="dialog-actions">
          <button @click="showAddToFolderDialog = false; resetFolderDialog()" class="cancel-btn">取消</button>
          <button 
            @click="confirmAddToFolder(); resetFolderDialog()" 
            class="confirm-btn"
            :disabled="!selectedFolderId"
          >
            确认添加
          </button>
        </div>
      </div>
    </div>

    <!-- 删除收藏夹对话框 -->
    <div class="dialog-overlay" v-if="showDeleteFolderDialog">
      <div class="dialog">
        <h3>删除收藏夹</h3>
        <p>确定要删除这个收藏夹吗？里面的书籍会回到书架。</p>
        <div class="dialog-actions">
          <button @click="showDeleteFolderDialog = false" class="cancel-btn">取消</button>
          <button 
            @click="confirmDeleteFolder(); showDeleteFolderDialog = false" 
            class="confirm-btn"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>

    <!-- 底部导航栏 -->
    <van-tabbar v-model="activeTab" @change="handleTabChange" safe-area-inset-bottom>
      <van-tabbar-item icon="home-o" name="bookstore">书城</van-tabbar-item>
      <van-tabbar-item icon="edit" name="create">创作</van-tabbar-item>
      <van-tabbar-item icon="bookmark-o" name="bookshelf">书架</van-tabbar-item>
      <van-tabbar-item icon="user-o" name="profile">我的</van-tabbar-item>
    </van-tabbar>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getFolders, createFolders, deleteFolders, searchFavorites, addFavorite, moveFavorite, deleteFavorite } from '../api/user';
import { showToast } from 'vant';

// 路由实例
const router = useRouter();


// 数据存储
const folders = ref([]);
const books = ref([]);
const folderToDelete = ref(null);

// 交互状态
const currentFolder = ref(null);
const showSearch = ref(false);
const searchQuery = ref('');
const selectedFolderId = ref('');
const showAddToFolderDialog = ref(false);
const currentBook = ref(null);
const isBatchMode = ref(false);
const selectedBooks = ref([]);
const showRemoveFromFolderDialog = ref(false);
const showDeleteFolderDialog = ref(false);

// 收藏夹相关状态
const folderName = ref('');
const showCreateFolderDialog = ref(false);

// 底部导航
const activeTab = ref('bookshelf');

// 处理底部导航切换
const handleTabChange = (name) => {
  switch(name) {
    case 'bookstore':
      router.push('/');
      break;
    case 'create':
      router.push('/create');
      break;
    case 'bookshelf':
      router.push('/bookshelf');
      break;
    case 'profile':
      router.push('/profile');
      break;
  }
};

// 加载收藏作品
const loadFavoriteBooks = async () => {
  try {
    const response = await searchFavorites('', 1);
    // 1. 提取后端返回的书籍数组（response.data.results.data）
    const rawBooks = response.data.results.data || [];
    
    // 2. 映射为前端需要的结构
    books.value = rawBooks.map(book => ({
      id: book.id,
      gameworkId: book.gamework_detail.id,  // 书籍ID
      title: book.gamework_detail.title,  // 标题
      author: book.gamework_detail.author,  // 作者
      cover: book.gamework_detail.cover || '默认封面图地址',  // 封面（处理null情况）
      folderId: book.folder !== null ? book.folder : null,
      isFavorite: true  // 收藏状态
    }));
    
    saveData();
  } catch (error) {
    const savedBooks = localStorage.getItem('favoriteBooks');
    try {
      // 解析本地存储时也可能出错，需要捕获
      books.value = savedBooks ? JSON.parse(savedBooks) : [];
    } catch (e) {
      console.error('解析本地书籍数据失败', e);
      books.value = []; // 确保是数组
    }
  }
};

// 加载收藏夹数据
const loadFolders = async () => {
  try {
    const response = await getFolders();
    folders.value = response.data.results;
    saveData();
  } catch (error) {
    console.error('加载收藏夹失败', error);
    const savedFoldersData = localStorage.getItem('bookFolders'); 
    if (savedFoldersData) {
      folders.value = JSON.parse(savedFoldersData); 
    }
  }
};

// 初始化加载数据
onMounted(() => {
  loadFolders();
  loadFavoriteBooks();
});

// 筛选书籍
const filteredBooks = computed(() => {
  const bookList = Array.isArray(books.value) ? books.value : [];
  let result = [...bookList];

  // 根据当前文件夹筛选
  if (currentFolder.value) {
    result = result.filter(book => book.folderId === currentFolder.value.id);
  } else {
    // 根目录下显示未分类的书籍（folderId为null或空）
    result = result.filter(book => !book.folderId);
  }
  
  // 搜索筛选
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(book => 
      book.title.toLowerCase().includes(query) || 
      (book.author && book.author.toLowerCase().includes(query))
    );
  }
  
  return result;
});

// 搜索防抖处理
const handleSearch = debounce(() => {
  // 防抖处理，避免频繁触发筛选
}, 300);

// 防抖函数实现
function debounce(func, delay = 300) {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

// 创建收藏夹
const handleCreateFolder = async () => {
  if (!folderName.value.trim()) {
    showToast({ message: '请输入收藏夹名称', type: 'fail' });
    return;
  }
  
  try {
    const response = await createFolders(folderName.value);
    const newFolder = response.data; 
    
    // 直接添加到本地列表，实时显示名称
    folders.value.push(newFolder);
    
    // 成功提示
    showToast({ message: '收藏夹创建成功', type: 'success' });
    
    folderName.value = '';
    showCreateFolderDialog.value = false;
    saveData(); // 立即保存到本地存储
    loadFolders();
  } catch (error) {
    console.error('创建收藏夹失败', error);
    // 错误提示
    showToast({ 
      message: error.response?.data?.message || '创建收藏夹失败', 
      type: 'fail' 
    });
  }
};


// 删除收藏夹
const confirmDeleteFolder = async () => {
  if (folderToDelete.value) {
    try {
      await deleteFolders(folderToDelete.value);
      
      // 将收藏夹中的书籍移回书架
      books.value.forEach(book => {
        if (book.folderId === folderToDelete.value) {
          book.folderId = null;
        }
      });
      
      // 如果删除当前打开的文件夹，自动返回根目录
      if (currentFolder.value && currentFolder.value.id === folderToDelete.value) {
        currentFolder.value = null;
      }
      
      loadFolders();
      saveData();
      folderToDelete.value = null;
      showToast({ message: '收藏夹已删除', duration: 1000 });
    } catch (error) {
      console.error('删除收藏夹失败', error);
      showToast(error.response?.data?.message || '删除收藏夹失败');
    }
  }
};

// 打开删除收藏夹对话框
const openDeleteFolderDialog = (folderId) => {
  folderToDelete.value = folderId;
  showDeleteFolderDialog.value = true;
};

// 处理书籍的收藏夹操作（加入或移出）
const handleFolderAction = (book) => {
  if (book.folderId) {
    // 如果已在收藏夹中，显示移除确认对话框
    currentBook.value = book;
    showRemoveFromFolderDialog.value = true;
  } else {
    // 如果不在收藏夹中，显示添加到收藏夹对话框
    currentBook.value = book;
    showAddToFolderDialog.value = true;
  }
};

// 批量加入收藏夹
const confirmAddToFolder = async () => {
  if (!selectedFolderId.value) return;
  
  try {
    // 缓存当前操作的书籍和目标文件夹ID
    const targetBook = currentBook.value;
    const targetFolderId = selectedFolderId.value;

    if (targetBook && targetBook.id) {
      // 1. 先更新本地状态（乐观更新）
      targetBook.folderId = targetFolderId;
      // 2. 再调用接口
      await moveFavorite(targetBook.id, targetFolderId);
      // 3. 接口成功后无需额外操作（已提前更新）
    } else if (selectedBooks.value.length) {
      // 批量移动逻辑保持不变
      const batchSize = 5;
      const batches = [];
      for (let i = 0; i < selectedBooks.value.length; i += batchSize) {
        batches.push(selectedBooks.value.slice(i, i + batchSize));
      }
      
      for (const batch of batches) {
        // 乐观更新
        batch.forEach(book => {
          book.folderId = targetFolderId;
        });
        // 调用接口
        await Promise.all(
          batch.map(book => moveFavorite(book.id, targetFolderId))
        );
      }
      
      selectedBooks.value = [];
      isBatchMode.value = false;
    }
    
    saveData();
    showAddToFolderDialog.value = false;
    selectedFolderId.value = '';
    showToast({ message: '添加成功', duration: 1000 });
  } catch (error) {
    // 接口失败时回滚本地状态
    if (currentBook.value) {
      currentBook.value.folderId = null; // 回滚到之前的状态（未分类）
    }
    console.error('添加到收藏夹失败', error);
    showToast({ message: '添加失败: ' + (error.response?.data?.message || '未知错误'), duration: 1000 });
  } finally {
    // 最后再重置currentBook，避免异步过程中被提前清空
    resetFolderDialog();
  }
};

// 单个作品移出收藏夹
const confirmRemoveFromFolder = async () => {
  if (currentBook.value) {
    try {
      await moveFavorite(currentBook.value.id, null);
      currentBook.value.folderId = null; // 清空所属收藏夹标识
      saveData();
      showRemoveFromFolderDialog.value = false;
      showToast({ message: '已移出收藏夹', duration: 1000 });
    } catch (error) {
      console.error('从收藏夹移除失败', error);
      showToast({ message: '移除失败: ' + (error.response?.data?.message || '未知错误'), duration: 1000 });
    }
  }
};

// 批量移出收藏夹
const removeSelectedFromFolder = async () => {
  if (selectedBooks.value.length === 0) return;
  
  try {
    // 批量调用moveFavorite，目标folderId为null（根目录）
    await Promise.all(
      selectedBooks.value.map(book => moveFavorite(book.id, null))
    );
    
    // 更新本地数据，清空folderId
    selectedBooks.value.forEach(book => {
      book.folderId = null;
    });
    
    saveData();
    selectedBooks.value = [];
    isBatchMode.value = false;
    showToast({ message: '已批量移出', duration: 1000 });
  } catch (error) {
    console.error('批量移出失败', error);
    showToast({ message: '批量移出失败: ' + (error.response?.data?.message || '未知错误'), duration: 1000 });
  }
};

// 获取收藏夹书籍数量
const getFolderBookCount = (folderId) => {
  if (!Array.isArray(books.value)) {
    return 0;
  }
  return books.value.filter(book => book.folderId === folderId).length;
};

// 进入收藏夹
const enterFolder = (folder) => {
  currentFolder.value = folder;
  searchQuery.value = '';
};

// 返回书架根目录
const goBack = () => {
  currentFolder.value = null;
  searchQuery.value = '';
};


// 批量管理相关函数
const toggleBatchMode = () => {
  isBatchMode.value = !isBatchMode.value;
  if (!isBatchMode.value) {
    selectedBooks.value = [];
  }
};

const toggleSelectBook = (book) => {
  const index = selectedBooks.value.findIndex(b => b.id === book.id);
  if (index > -1) {
    selectedBooks.value.splice(index, 1);
  } else {
    selectedBooks.value.push(book);
  }
};

const cancelBatchMode = () => {
  isBatchMode.value = false;
  selectedBooks.value = [];
};

// 打开阅读器
const openReader = (bookId) => {
  router.push(`/works/${bookId}`);
};

// 重置收藏夹对话框状态
const resetFolderDialog = () => {
  currentBook.value = null;
  selectedFolderId.value = '';
  showRemoveFromFolderDialog.value = false;
};

// 保存数据到本地存储
const saveData = () => {
  localStorage.setItem('favoriteBooks', JSON.stringify(books.value));
  localStorage.setItem('bookFolders', JSON.stringify(folders.value));
};

// 在取消收藏时从列表中移除书籍
const handleFavorite = async (book) => {
  try {
    if (book.isFavorite) {
      // 取消收藏：调用删除接口并从列表中移除
      await deleteFavorite(book.gameworkId);
      
      // 从books数组中移除该书籍
      const index = books.value.findIndex(b => b.id === book.id);
      if (index !== -1) {
        books.value.splice(index, 1);
      }
      
      showToast({ message: '已取消收藏', duration: 1000 });
    } else {
      // 添加收藏逻辑保持不变
      await addFavorite(book.gameworkId);
      book.isFavorite = true;
      showToast({ message: '收藏成功', duration: 1000 });
    }
    saveData(); // 保存最新状态到本地存储
  } catch (error) {
    console.error('处理收藏失败', error);
    showToast(error.response?.data?.message || '操作失败');
  }
};
</script>

<style scoped>
.bookshelf-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

.header h1 {
  margin: 0;
  font-size: 24px;
  color: #333;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.icon-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

/* 统一所有图标的容器尺寸 */
.icon-btn .add-folder-icon,
.icon-btn .back-icon,
.icon-btn .search-icon,
.icon-btn .batch-icon {
  width: 24px; /* 固定宽度 */
  height: 24px; /* 固定高度 */
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* 确保SVG图标自适应容器大小 */
.icon-btn svg {
  width: 100%;
  height: 100%;
  object-fit: contain; /* 保持SVG比例 */
}

.txt{
  font-size: 10px;
  color: #555;
}

.search-container {
  position: relative;
  margin-bottom: 20px;
}

.search-input {
  width: 100%;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid #ddd;
  font-size: 16px;
}

.clear-search {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #999;
}

.section-title {
  font-size: 18px;
  color: #555;
  margin: 20px 0 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.count {
  font-size: 14px;
  color: #999;
  font-weight: normal;
}

.folders-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 15px;
  margin-bottom: 30px;
}

.folder-item {
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  position: relative;
}

.folder-item:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.folder-icon {
  width: 100%;
  height: 50px;
}

.folder-icon svg {
  width: 100%;  
  height: 100%;
}

.folder-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.folder-count {
  font-size: 12px;
  color: #777;
}

.folder-delete-icon {
  position: absolute;
  top: -4px;
  right: -3px; 
  cursor: pointer;
  transition: opacity 0.2s;
  width: 15px;
  height: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  text-transform: uppercase;
}

.folder-delete-icon svg path{
  fill: #B88484; 
}

.folder-delete-icon:hover {
  opacity: 1;
  transform: scale(1.1); 
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
}

.books-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.book-item {
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  height: 120px ! important;
}

.book-cover {
  position: relative;
  width: 100%;
  margin-left: auto;
  margin-right: auto;
  border-radius: 8px;
  overflow: hidden;
  height: 100px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

.book-info-grid{
  padding: 0 2px;
  display: grid;
  grid-template-columns: 3fr 1fr;
}

.favorite-icon {
  font-size: 18px;
  color: #888;
  margin-left: 12px;
  flex-shrink: 0;
}

.favorite-icon.active {
  color: #ffcc00;
}


.book-title {
  font-size: 14px;
  width: 90px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-author {
  font-size: 14px;
  color: #777;
  margin-bottom: 8px;
}

.folder-select {
  width: 100%;
  padding: 4px;
  border-radius: 4px;
  border: 1px solid #ddd;
  font-size: 12px;
}

.empty-state {
  text-align: center;
  padding: 40px 0;
  color: #999;
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background-color: white;
  border-radius: 8px;
  padding: 20px;
  width: 90%;
  max-width: 400px;
}

.dialog h3 {
  margin-top: 0;
  color: #333;
}

.folder-select{
  padding: 10px 0;
}
.folder-input {
  width: 100%;
  padding: 10px;
  border-radius: 4px;
  border: 1px solid #ddd;
  margin-bottom: 15px;
  font-size: 16px;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  margin-top: 5px;
}

.cancel-btn, .confirm-btn {
  font-size: 16px;
  padding: 8px 16px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  flex: 1;
}

.cancel-btn {
  background-color: #f0f0f0;
}

.confirm-btn {
  color: white;
  background: linear-gradient(135deg, #d4a5a5 0%, #b88484 100%);
}

.btn-group {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
}

.folder-action-icon {
  font-size: 18px;
  cursor: pointer;
}

.folder-action-icon.in-folder {
  color: #ff4d4f;
}

.batch-actions {
  display: flex;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
  margin-bottom: 15px;
}

.batch-btn {
  padding: 6px 12px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  background: #b88484;
  color: white;
}

.batch-btn.remove-btn {
  background: #a73f3f;
}

.batch-btn.cancel-btn {
  background: #978787;
}

.batch-select {
  position: absolute;
  top: 5px;
  left: 5px;
  z-index: 10;
}

.book-item {
  position: relative;
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  height: 150px;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #eee;
}

.folder-input {
  padding: 0 16px;
  margin-top: 16px;
}

.popup-footer {
  padding: 16px;
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: #fff;
  box-sizing: border-box;
}

@media (max-width: 768px) {
  .books-grid {
    grid-template-columns: repeat(2,1fr);
  }
}

/* 底部导航栏 */
.van-tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: #faf8f3;
}

::v-deep .van-tabbar-item--active {
  background-color: transparent !important;
}

::v-deep .van-tabbar-item:not(.van-tabbar-item--active){
  color: #999 !important;
}

::v-deep .van-tabbar-item--active {
  color: #d16e6e !important;
}
</style>